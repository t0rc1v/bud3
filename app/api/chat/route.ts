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

  // Get current date/time for context
  const now = new Date();
  const currentDateTime = now.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  // Build system prompt with context
  let systemPrompt = `You are a helpful AI assistant for an educational platform called Bud. 
You help teachers, students, and admins with their questions about educational content.

Current date and time: ${currentDateTime}

You have access to the following tools. Use them strategically based on the user's needs:

1. web_search - Use this for general web searches to find current information, articles, news, or facts. Best for general knowledge questions, current events, or research topics. Consider the current date when searching for time-sensitive information.
2. youtube_search - Use this ONLY when the user specifically asks for video content, tutorials, or educational videos. Do not use for general information searches.
3. research_materials - Use this when the user is looking for educational resources, lesson materials, or teaching content across multiple formats (videos, articles, PDFs). Best for "find resources for teaching X" or "lesson plan materials".
4. fetch_memory - Use this to retrieve saved memories from the database. Use when the user asks about something they previously saved (e.g., "what did I save about...", "show my notes on...", "remember when I...").
5. save_memory - Use this to save important information to memory for future reference. Save things like: student results, lesson plans, important notes, preferences, or any data the user might want to recall later. Always confirm what you're saving with the user and include timestamps when relevant.
6. server_actions - Use this to call specific backend functions that are exposed to you. This allows you to perform system operations like managing learners, grades, or resources when the user requests them.
7. web_browse - Use this when the user provides a specific URL and asks you to read, summarize, or analyze its content. Works with web pages, PDFs, and documents.
8. get_current_time - Use this to get the current date and time. Use when the user asks about scheduling, deadlines, or time-sensitive calculations.

When responding:
- Be concise and educational
- Always cite your sources when using search results
- Confirm before saving memories
- Use the right tool for the job - don't use web_search when fetch_memory would work
- Be aware of the current date when providing time-sensitive information`;

  // Add date context section
  systemPrompt += `\n\nCurrent Date Context:
- Today's date: ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
- Current time: ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  
  // Calculate academic year (assuming school year starts in August/September)
  const month = now.getMonth();
  const year = now.getFullYear();
  const academicYear = month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  systemPrompt += `\n- Current academic year (approximate): ${academicYear}`;
  
  // Day of week context
  const daysUntilWeekend = 6 - now.getDay();
  if (daysUntilWeekend >= 0 && daysUntilWeekend <= 2) {
    systemPrompt += `\n- Weekend is in ${daysUntilWeekend} day${daysUntilWeekend !== 1 ? 's' : ''}`;
  }

  // Add memory context if available
  if (memoryItems && memoryItems.length > 0) {
    systemPrompt += `\n\nYou have access to the following saved memory (use fetch_memory tool to retrieve specific details):\n`;
    memoryItems.forEach((item: MemoryItem) => {
      systemPrompt += `- ${item.title} (${item.category || 'uncategorized'}): ${item.description || 'No description'}\n`;
    });
    systemPrompt += `\nWhen the user asks about any of these topics, use the fetch_memory tool with the appropriate category or search term to get the full details.`;
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
      save_memory: tool({
        description: 'Save important information to memory for future reference. Save things like: student results, lesson plans, important notes, preferences, or any data the user might want to recall later. Always confirm what you\'re saving with the user. Use clear, descriptive titles and appropriate categories for easy retrieval.',
        inputSchema: z.object({
          title: z.string().describe('A clear, descriptive title for this memory (e.g., "John\'s Math Test Results", "Lesson Plan: Photosynthesis")'),
          category: z.string().describe('Category for organization (e.g., "student_results", "lesson_plans", "notes", "preferences")'),
          content: z.any().describe('The structured data to save (JSON object with relevant details)'),
          description: z.string().describe('A brief description explaining what this memory contains and when to use it'),
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
            return { success: true, message: `Memory "${title}" saved successfully in category "${category}"` };
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },
      }),
      web_browse: tool({
        description: 'Browse a URL to extract its content. Use this ONLY when the user provides a specific URL and asks you to read, summarize, or analyze its content. Works with web pages, PDFs, and documents hosted on the web.',
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
      fetch_memory: tool({
        description: 'Retrieve saved memories from the database. Use this when the user asks about previously saved information (e.g., "what did I save about...", "show my notes on...", "remember when I..."). Search by category or keywords to find relevant memories.',
        inputSchema: z.object({
          category: z.string().optional().describe('Optional: Filter memories by category (e.g., "student_results", "lesson_plans", "notes")'),
          searchTerm: z.string().optional().describe('Optional: Search term to find memories by title or description'),
          limit: z.number().optional().describe('Maximum number of memories to return (default: 10)'),
        }),
        execute: async ({ category, searchTerm, limit = 10 }) => {
          try {
            const { getMemoryItems, getMemoryItemsByCategory } = await import('@/lib/actions/ai');
            
            let memories;
            if (category) {
              memories = await getMemoryItemsByCategory(userId, category);
            } else {
              memories = await getMemoryItems(userId);
            }
            
            // Filter by search term if provided
            if (searchTerm) {
              const searchLower = searchTerm.toLowerCase();
              memories = memories.filter(m => 
                m.title.toLowerCase().includes(searchLower) ||
                (m.description && m.description.toLowerCase().includes(searchLower)) ||
                JSON.stringify(m.content).toLowerCase().includes(searchLower)
              );
            }
            
            // Apply limit
            memories = memories.slice(0, limit);
            
            return {
              success: true,
              memories: memories.map(m => ({
                id: m.id,
                title: m.title,
                category: m.category,
                description: m.description,
                content: m.content,
                createdAt: m.createdAt,
                updatedAt: m.updatedAt,
              })),
              count: memories.length,
            };
          } catch (error) {
            return {
              success: false,
              error: `Failed to fetch memories: ${error instanceof Error ? error.message : String(error)}`,
            };
          }
        },
      }),
      server_actions: tool({
        description: 'Call exposed server-side functions to perform system operations. Available actions include: get_grades (list all grades/levels), add_learner (add a learner to teacher\'s list), get_my_learners (list teacher\'s learners), create_resource (create educational resources), get_resources (list resources). Use this when the user requests operations that require backend data manipulation.',
        inputSchema: z.object({
          action: z.enum(['get_grades', 'add_learner', 'get_my_learners', 'create_resource', 'get_resources', 'get_subjects', 'get_topics']),
          params: z.any().optional(),
        }),
        execute: async ({ action, params = {} }) => {
          try {
            switch (action) {
              case 'get_grades': {
                const { getGrades } = await import('@/lib/actions/teacher');
                const grades = await getGrades();
                return {
                  success: true,
                  action: 'get_grades',
                  data: grades.map(g => ({
                    id: g.id,
                    title: g.title,
                    gradeNumber: g.gradeNumber,
                    level: g.level,
                    subjects: g.subjects?.map((s: { name: string; id: string }) => s.name) || [],
                  })),
                };
              }
              
              case 'add_learner': {
                const { addMyLearner } = await import('@/lib/actions/teacher');
                const { email, gradeId, metadata } = params;
                if (!email || !gradeId) {
                  return {
                    success: false,
                    error: 'Missing required parameters: email and gradeId are required',
                  };
                }
                await addMyLearner(userId, email as string, gradeId as string, metadata as Record<string, unknown>);
                return {
                  success: true,
                  action: 'add_learner',
                  message: `Learner with email ${email} added successfully`,
                };
              }
              
              case 'get_my_learners': {
                const { getMyLearners } = await import('@/lib/actions/teacher');
                const learners = await getMyLearners(userId);
                return {
                  success: true,
                  action: 'get_my_learners',
                  data: learners.map(l => ({
                    id: l.id,
                    learnerId: l.learnerId,
                    email: l.learnerEmail,
                    gradeId: l.gradeId,
                    gradeTitle: l.grade?.title,
                    metadata: l.metadata,
                  })),
                };
              }
              
              case 'create_resource': {
                const { createResource } = await import('@/lib/actions/teacher');
                const { subjectId, topicId, title, description, type, url, thumbnailUrl, metadata } = params;
                if (!subjectId || !topicId || !title || !description || !type || !url) {
                  return {
                    success: false,
                    error: 'Missing required parameters: subjectId, topicId, title, description, type, and url are required',
                  };
                }
                await createResource({
                  subjectId: subjectId as string,
                  topicId: topicId as string,
                  title: title as string,
                  description: description as string,
                  type: type as "notes" | "video" | "audio" | "image",
                  url: url as string,
                  thumbnailUrl: thumbnailUrl as string | undefined,
                  metadata: metadata as Record<string, unknown> | undefined,
                });
                return {
                  success: true,
                  action: 'create_resource',
                  message: `Resource "${title}" created successfully`,
                };
              }
              
              case 'get_resources': {
                const { getResources } = await import('@/lib/actions/teacher');
                const resources = await getResources();
                return {
                  success: true,
                  action: 'get_resources',
                  data: resources.map(r => ({
                    id: r.id,
                    title: r.title,
                    description: r.description,
                    type: r.type,
                    subject: r.subject?.name,
                    topic: r.topic?.title,
                    url: r.url,
                  })),
                };
              }
              
              case 'get_subjects': {
                const { getSubjects } = await import('@/lib/actions/teacher');
                const subjects = await getSubjects();
                return {
                  success: true,
                  action: 'get_subjects',
                  data: subjects.map(s => ({
                    id: s.id,
                    name: s.name,
                    grade: s.grade?.title,
                    topicCount: s.topics?.length || 0,
                  })),
                };
              }
              
              case 'get_topics': {
                const { getTopics } = await import('@/lib/actions/teacher');
                const topics = await getTopics();
                return {
                  success: true,
                  action: 'get_topics',
                  data: topics.map(t => ({
                    id: t.id,
                    title: t.title,
                    subject: t.subject?.name,
                    resourceCount: t.resources?.length || 0,
                  })),
                };
              }
              
              default:
                return {
                  success: false,
                  error: `Unknown action: ${action}`,
                };
            }
          } catch (error) {
            return {
              success: false,
              action,
              error: `Failed to execute ${action}: ${error instanceof Error ? error.message : String(error)}`,
            };
          }
        },
      }),
      get_current_time: tool({
        description: 'Get the current date and time. Use this when the user asks about scheduling, deadlines, planning events, or any time-sensitive calculations. Also useful when saving memories that should include timestamps.',
        inputSchema: z.object({
          format: z.enum(['full', 'date-only', 'time-only', 'iso']).optional().describe('Format of the datetime to return (default: full)'),
          timezone: z.string().optional().describe('Timezone to use (default: local timezone)'),
        }),
        execute: async ({ format = 'full', timezone }) => {
          try {
            const now = new Date();
            let formatted;
            
            switch (format) {
              case 'date-only':
                formatted = now.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  timeZone: timezone,
                });
                break;
              case 'time-only':
                formatted = now.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  timeZone: timezone,
                });
                break;
              case 'iso':
                formatted = now.toISOString();
                break;
              case 'full':
              default:
                formatted = now.toLocaleString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  timeZoneName: 'short',
                  timeZone: timezone,
                });
                break;
            }
            
            return {
              success: true,
              datetime: formatted,
              iso: now.toISOString(),
              timestamp: now.getTime(),
              timezone: timezone || 'local',
              format,
              components: {
                year: now.getFullYear(),
                month: now.getMonth() + 1,
                day: now.getDate(),
                hour: now.getHours(),
                minute: now.getMinutes(),
                second: now.getSeconds(),
                dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
                dayOfYear: Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)),
              },
              academicYear: now.getMonth() >= 7 
                ? `${now.getFullYear()}-${now.getFullYear() + 1}` 
                : `${now.getFullYear() - 1}-${now.getFullYear()}`,
            };
          } catch (error) {
            return {
              success: false,
              error: `Failed to get current time: ${error instanceof Error ? error.message : String(error)}`,
            };
          }
        },
      }),
    },
    onFinish: async ({ response }) => {
      // Save all messages to the database if chatId is provided
      if (chatId) {
        try {
          const { saveChatMessage } = await import('@/lib/actions/ai');
          
          // Create a map of toolCallId -> tool result for easy lookup
          const toolResultsById = new Map<string, unknown>();
          
          // First, extract all tool results from tool messages
          const toolMessages = response.messages.filter(m => m.role === 'tool');
          
          for (const toolMessage of toolMessages) {
            if (Array.isArray(toolMessage.content)) {
              for (const part of toolMessage.content as Array<{ type: string; toolCallId?: string; toolName?: string; output?: unknown; result?: unknown }>) {
                if (part.type === 'tool-result' && part.toolCallId) {
                  // AI SDK uses 'output' not 'result'
                  const output = part.output !== undefined ? part.output : part.result;
                  toolResultsById.set(part.toolCallId, output);
                }
              }
            }
          }
          
          // Now process assistant messages and attach results directly to tool calls
          const assistantMessages = response.messages.filter(m => m.role === 'assistant');
          
          for (const assistantMessage of assistantMessages) {
            let contentStr = '';
            const toolCallsWithResults: Array<{ toolCallId: string; toolName: string; input: unknown; output?: unknown }> = [];
            
            if (Array.isArray(assistantMessage.content)) {
              for (const part of assistantMessage.content as Array<{ type: string; text?: string; toolCallId?: string; toolName?: string; input?: unknown; args?: unknown }>) {
                if (part.type === 'text') {
                  contentStr += part.text || '';
                } else if (part.type === 'tool-call') {
                  const toolCallId = part.toolCallId || '';
                  const output = toolResultsById.get(toolCallId);
                  
                  // AI SDK uses 'input' not 'args'
                  const input = part.input !== undefined ? part.input : part.args;
                  
                  toolCallsWithResults.push({
                    toolCallId: toolCallId,
                    toolName: part.toolName || 'unknown',
                    input: input || {},
                    output: output, // Attach the output directly to the tool call
                  });
                }
              }
            } else if (typeof assistantMessage.content === 'string') {
              contentStr = assistantMessage.content;
            }
            
            // Save assistant message with tool calls AND their results in metadata
            const metadata: Record<string, unknown> = {};
            if (toolCallsWithResults.length > 0) {
              metadata.toolCalls = toolCallsWithResults;
            }
            
            await saveChatMessage({
              chatId,
              role: 'assistant',
              content: contentStr,
              metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
            });
          }
        } catch (error) {
          console.error('Failed to save chat messages:', error);
        }
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
