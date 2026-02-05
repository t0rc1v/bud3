import { streamText, UIMessage, convertToModelMessages, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { getModel } from '@/lib/ai/providers';

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
1. web_search - Search the web for information
2. youtube_search - Search YouTube for educational videos
3. save_memory - Save important information to memory for future reference
4. web_browse - Browse any URL to extract its content (web pages, PDFs, documents)

When responding:
- Be concise and educational
- Use the available tools when needed to provide accurate information
- When the user asks about a URL, use the web_browse tool to read it`;

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
        description: 'Search the web for current information on any topic',
        inputSchema: z.object({
          query: z.string().describe('The search query'),
        }),
        execute: async ({ query }) => {
          // This is a placeholder - in production, integrate with Exa AI or similar
          return {
            results: [
              { title: 'Web search not yet configured', url: '', snippet: 'Please configure Exa AI integration' }
            ]
          };
        },
      }),
      youtube_search: tool({
        description: 'Search YouTube for educational videos',
        inputSchema: z.object({
          query: z.string().describe('The search query'),
        }),
        execute: async ({ query }) => {
          // This is a placeholder - in production, integrate with YouTube API via Exa AI
          return {
            results: [
              { title: 'YouTube search not yet configured', url: '', snippet: 'Please configure Exa AI integration' }
            ]
          };
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
