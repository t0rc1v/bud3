import { streamText, UIMessage, convertToModelMessages, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { getModel } from '@/lib/ai/providers';
import {
  searchWeb,
  searchYouTube,
  researchMaterials,
  formatSearchResultsForAI,
} from '@/lib/ai/tools';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

interface MemoryItem {
  id: string;
  userId: string;
  title: string;
  category: string | null;
  content: Record<string, unknown>;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { messages, chatId }: { 
    messages: UIMessage[]; 
    chatId?: string;
  } = await req.json();

  // Save the user's message to the database if chatId is provided
  if (chatId && messages.length > 0) {
    try {
      const { saveChatMessage } = await import('@/lib/actions/ai');
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        // Extract text content from message parts
        let contentStr = '';
        const attachedResources: Array<{id: string; title: string; url: string; type: string}> = [];
        
        if (lastMessage.parts && Array.isArray(lastMessage.parts)) {
          lastMessage.parts.forEach((part: { type: string; text?: string; filename?: string; url?: string; mediaType?: string }) => {
            if (part.type === 'text') {
              contentStr += part.text || '';
            } else if (part.type === 'file') {
              // Extract resource info from file part
              // The URL contains the resource ID or we can extract it from filename
              attachedResources.push({
                id: part.filename || 'unknown',
                title: part.filename || 'Attached file',
                url: part.url || '',
                type: part.mediaType?.startsWith('image/') ? 'image' : 
                      part.mediaType === 'application/pdf' ? 'notes' : 'file'
              });
            }
          });
        }
        
        if (contentStr.trim()) {
          await saveChatMessage({
            chatId,
            role: 'user',
            content: contentStr,
            metadata: attachedResources.length > 0 ? { attachedResources } : undefined,
          });
        }
      }
    } catch (error) {
      console.error('Failed to save user message:', error);
    }
  }

  // Get user's memory items for context
  let memoryItems: MemoryItem[] = [];
  try {
    const { getMemoryItems } = await import('@/lib/actions/ai');
    memoryItems = await getMemoryItems(userId);
  } catch (error) {
    console.error('Failed to load memory items:', error);
  }

  // Build system prompt with context
  let systemPrompt = `You are a helpful AI assistant for an educational platform called Bud. 
You help teachers, students, and admins with their questions about educational content.

You have access to the following tools:
1. web_search - Search the web for current information, articles, and web pages
2. youtube_search - Search YouTube specifically for educational videos
3. research_materials - Comprehensive research tool that searches multiple sources (web, YouTube, research papers) for educational materials. Use this when looking for lesson materials or topic resources.
4. save_memory - Save important information to memory for future reference (e.g., student results, lesson plans, important notes)
5. add_learner - Add a learner to the teacher's my_learners list (teachers only)
6. web_browse - Browse any URL to extract its content (web pages, PDFs, documents, images)

When responding:
- Be concise and educational
- Use web_search for general web information
- Use youtube_search specifically when the user asks for video content
- Use research_materials when the user is looking for educational resources to use in lessons
- Use save_memory when the user wants to save important information for future reference
- Use web_browse when a specific URL is provided to read its contents
- Always cite your sources when using search results`;

  // Add memory context if available
  if (memoryItems && memoryItems.length > 0) {
    systemPrompt += `\n\nYou have access to the following saved memory:\n`;
    memoryItems.forEach((item: MemoryItem) => {
      systemPrompt += `- ${item.title}: ${JSON.stringify(item.content)}\n`;
    });
  }

  const result = streamText({
    model: getModel(),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools: {
      web_search: tool({
        description: 'Search the web for current information on any topic. Returns web pages, articles, and documents relevant to the query.',
        inputSchema: z.object({
          query: z.string().describe('The search query'),
          numResults: z.number().optional().describe('Number of results to return (default: 10)'),
          category: z.enum(['company', 'research paper', 'news', 'tweet', 'personal site', 'financial report', 'people']).optional().describe('Optional category to filter results'),
        }),
        execute: async ({ query, numResults = 10, category }) => {
          try {
            const results = await searchWeb(query, {
              numResults,
              type: 'auto',
              category,
            });
            return {
              results,
              formatted: formatSearchResultsForAI(results, 'web'),
            };
          } catch (error) {
            return {
              success: false,
              error: `Failed to search web: ${error instanceof Error ? error.message : String(error)}`,
            };
          }
        },
      }),
      youtube_search: tool({
        description: 'Search YouTube for educational videos. Returns video results with titles, URLs, descriptions, and thumbnails.',
        inputSchema: z.object({
          query: z.string().describe('The search query for educational videos'),
          numResults: z.number().optional().describe('Number of results to return (default: 10)'),
        }),
        execute: async ({ query, numResults = 10 }) => {
          try {
            const results = await searchYouTube(query, {
              numResults,
              type: 'auto',
            });
            return {
              results,
              formatted: formatSearchResultsForAI(results, 'youtube'),
            };
          } catch (error) {
            return {
              success: false,
              error: `Failed to search YouTube: ${error instanceof Error ? error.message : String(error)}`,
            };
          }
        },
      }),
      research_materials: tool({
        description: 'Research and find educational materials from multiple sources (web articles, YouTube videos, research papers). This is a comprehensive search that aggregates results from various sources for lesson planning or topic research.',
        inputSchema: z.object({
          query: z.string().describe('The research query for finding educational materials'),
          numResults: z.number().optional().describe('Total number of results to return (default: 15)'),
          materialTypes: z.array(z.enum(['video', 'article', 'pdf'])).optional().describe('Types of materials to search for (default: all types)'),
        }),
        execute: async ({ query, numResults = 15, materialTypes = ['video', 'article', 'pdf'] }) => {
          try {
            const results = await researchMaterials(query, {
              numResults,
              materialTypes,
            });
            return {
              results,
              formatted: formatSearchResultsForAI(results, 'research'),
            };
          } catch (error) {
            return {
              success: false,
              error: `Failed to research materials: ${error instanceof Error ? error.message : String(error)}`,
            };
          }
        },
      }),
      get_grades: tool({
        description: 'Get a list of all available grades/levels in the system. Use this when a teacher wants to add a learner but is unsure which grade ID to use.',
        inputSchema: z.object({}),
        execute: async () => {
          try {
            const { getGrades } = await import('@/lib/actions/teacher');
            const grades = await getGrades();
            return {
              success: true,
              grades: grades.map(g => ({
                id: g.id,
                title: g.title,
                gradeNumber: g.gradeNumber,
                level: g.level,
                subjects: g.subjects?.map((s: { name: string; id: string }) => s.name) || [],
              })),
            };
          } catch (error) {
            return {
              success: false,
              error: `Failed to get grades: ${error instanceof Error ? error.message : String(error)}`,
            };
          }
        },
      }),
      save_memory: tool({
        description: 'Save important information to memory for future reference',
        inputSchema: z.object({
          title: z.string().describe('A title for this memory'),
          category: z.string().describe('Category for organization (e.g., "student_results", "lesson_plans")'),
          content: z.any().describe('The structured data to save'),
          description: z.string().describe('A description of what this memory contains'),
        }),
        execute: async ({ title, category, content, description }) => {
          try {
            const { saveMemoryItem } = await import('@/lib/actions/ai');
            await saveMemoryItem({
              userId,
              title,
              category,
              content,
              description,
            });
            return { success: true, message: 'Memory saved successfully' };
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },
      }),
      add_learner: tool({
        description: 'Add a learner to the teacher\'s my_learners list (teachers only)',
        inputSchema: z.object({
          email: z.string().describe('The learner\'s email address'),
          gradeId: z.string().describe('The grade ID for the learner'),
          metadata: z.object({}).optional().describe('Optional metadata about the learner'),
        }),
        execute: async ({ email, gradeId, metadata }) => {
          try {
            const { addMyLearner } = await import('@/lib/actions/teacher');
            await addMyLearner(userId, email, gradeId, metadata);
            return { success: true, message: 'Learner added successfully' };
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },
      }),
      web_browse: tool({
        description: 'Browse a URL to extract its content. Use this to read web pages, PDFs, or other documents. This tool works with any URL including PDF files hosted on the web.',
        inputSchema: z.object({
          url: z.string().describe('The URL to browse and extract content from'),
          maxCharacters: z.number().optional().describe('Maximum characters to return (default: 10000)'),
        }),
        execute: async ({ url, maxCharacters = 10000 }) => {
          try {
            const { browseUrl } = await import('@/lib/ai/web-browse');
            const result = await browseUrl(url, { maxCharacters });
            
            if (result.status === "error") {
              return { 
                success: false, 
                error: result.error || "Failed to browse URL" 
              };
            }
            
            return {
              success: true,
              title: result.title,
              url: result.url,
              content: result.content,
            };
          } catch (error) {
            return { 
              success: false, 
              error: `Failed to browse URL: ${error instanceof Error ? error.message : String(error)}` 
            };
          }
        },
      }),
    },
    onFinish: async ({ response }) => {
      // Save the assistant's response to the database if chatId is provided
      if (chatId) {
        try {
          const { saveChatMessage } = await import('@/lib/actions/ai');
          const assistantMessage = response.messages.find(m => m.role === 'assistant');
          if (assistantMessage) {
            // Convert content array to string
            let contentStr = '';
            if (Array.isArray(assistantMessage.content)) {
              contentStr = assistantMessage.content.map((part: { type: string; text?: string }) => {
                if (part.type === 'text') return part.text || '';
                return '';
              }).join('');
            } else if (typeof assistantMessage.content === 'string') {
              contentStr = assistantMessage.content;
            }
            
            await saveChatMessage({
              chatId,
              role: 'assistant',
              content: contentStr,
            });
          }
        } catch (error) {
          console.error('Failed to save chat message:', error);
        }
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
