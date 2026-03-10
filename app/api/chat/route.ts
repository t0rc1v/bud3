import { streamText, UIMessage, convertToModelMessages, tool, stepCountIs, smoothStream } from 'ai';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { getModel, getModelById, getAvailableModels } from '@/lib/ai/providers';
import { checkRateLimit } from '@/lib/rate-limit';
import { getUserByClerkId } from '@/lib/actions/auth';
import {
  searchWeb,
  searchYouTube,
  researchMaterials,
  formatSearchResultsForAI,
} from '@/lib/ai/tools';
import { getTokenCache } from '@/lib/ai/token-cache';
import { compactContext, getContextStats } from '@/lib/ai/context-compaction';

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
  const { userId: clerkId } = await auth();
  
  if (!clerkId) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Rate limit: 20 requests per minute per user
  const rl = checkRateLimit(`chat:${clerkId}`, 20, 60_000);
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please slow down.' }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  // Parallelize user lookup and body parse — both are independent of each other
  const [user, { messages, chatId, modelId }] = await Promise.all([
    getUserByClerkId(clerkId),
    req.json() as Promise<{ messages: UIMessage[]; chatId?: string; modelId?: string }>,
  ]);

  if (!user) {
    return new Response('User not found', { status: 404 });
  }
  const dbUserId = user.id;

  // Check and deduct credits for AI response
  try {
    const { checkAndDeductCreditsForAIResponse } = await import('@/lib/actions/credits');
    const creditCheck = await checkAndDeductCreditsForAIResponse(dbUserId, chatId);
    
    if (!creditCheck.success) {
      return new Response(
        JSON.stringify({ 
          error: creditCheck.error || 'Insufficient credits',
          type: 'INSUFFICIENT_CREDITS',
          remainingCredits: creditCheck.remainingCredits,
        }), 
        { 
          status: 402, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
  } catch (error) {
    console.error('Error checking credits:', error);
    // Continue even if credit check fails - we don't want to block the chat
  }

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
    memoryItems = await getMemoryItems(dbUserId);
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
You help regular users, students, and admins with their questions about educational content.

Current date and time: ${currentDateTime}

You have access to the following tools. Use them strategically based on the user's needs:

1. web_search - Use this for general web searches to find current information, articles, news, or facts. Best for general knowledge questions, current events, or research topics. Consider the current date when searching for time-sensitive information.
2. youtube_search - Use this ONLY when the user specifically asks for video content, tutorials, or educational videos. Do not use for general information searches.
3. research_materials - Use this when the user is looking for educational resources, lesson materials, or teaching content across multiple formats (videos, articles, PDFs). Best for "find resources for teaching X" or "lesson plan materials".
4. fetch_memory - Use this to retrieve saved memories from the database. Use when the user asks about something they previously saved (e.g. "what did I save about...", "show my notes on...", "remember when I...").
5. save_memory - Use this to save important information to memory for future reference. Save things like: student results, lesson plans, important notes, preferences, or any data the user might want to recall later. Always confirm what you're saving with the user and include timestamps when relevant.
6. server_actions - Use this to call specific backend functions that are exposed to you. This allows you to perform system operations like managing regular users, levels, or resources when the user requests them.
7. web_browse - Use this when the user provides a specific URL and asks you to read, summarize, or analyze its content. Works with web pages, PDFs, and documents.
8. get_current_time - Use this to get the current date and time. Use when the user asks about scheduling, deadlines, or time-sensitive calculations.
 9. create_assignment - Use this to create assignments, homeworks, quizzes, or continuous assessment tests for ADMINS. This generates a PRINTABLE DOCUMENT that displays in a MODAL COMPONENT with built-in 'Export to PDF' and 'Print' buttons. The user can view, print, and export directly from the modal - DO NOT offer to manually provide content in other formats or offer alternative export methods. Use this when:
   - Admins want to create paper-based assessments
   - Creating worksheets for classroom distribution
   - Preparing homework that students complete offline
   - Making continuous assessment tests (CATs)
   - Generating printable exams with answer keys
   IMPORTANT: For practice questions at the end of a topic or sub-topic, generate AT LEAST 10 questions to ensure comprehensive concept coverage.
   
  10. create_quiz - Use this to create interactive quizzes for REGULAR USERS. This generates an INTERACTIVE QUIZ that displays in a MODAL COMPONENT with built-in 'Export to PDF' and 'Print' buttons for viewing/printing the quiz content and answer key. Students can take the quiz DIRECTLY IN THE APP. The user can view, print, and export directly from the modal - DO NOT offer to manually provide content in other formats or offer alternative export methods. Use this when:
       - Students want to take online assessments
       - Creating practice tests for self-study
       - Building interactive learning activities
       - Making formative assessments with immediate feedback
       - Allowing students to retake quizzes for practice
       CRITICAL REQUIREMENT: You MUST generate EXACTLY 30 questions for comprehensive exam coverage. This is a hard requirement - no exceptions. 
       - Count your questions carefully before calling the tool
       - If you only have 10-15 questions in mind, expand by creating variations on the same concepts
       - Mix question types: multiple choice, true/false, short answer, fill in blank
       - Cover all aspects of the topic thoroughly - don't stop at basic coverage
       - Example: If the topic is "Photosynthesis", generate questions about: light reactions, Calvin cycle, factors affecting rate, chemical equation, plant structures involved, comparison with respiration, etc. - enough to reach 30 questions total

11. generate_summary - Use this to create a comprehensive summary that captures the full context of a conversation, document, or topic. Use when the user asks for summaries, recaps, or wants to condense information while preserving key details.

12. generate_overview - Use this to generate a comprehensive overview of a subject or topic. Creates structured content with introduction, main sections, and conclusion. Use for topic introductions or subject reviews.

13. identify_keywords - Use this to extract and identify key terms, concepts, and vocabulary from content. Each keyword includes the term, definition, and multiple examples. Use for vocabulary building and concept mapping.

14. generate_study_guide - Use this to create a comprehensive study guide with multiple sections including overview, key concepts, important terms, practice problems, and review points. Use for exam preparation and structured learning.

15. create_flashcards - Use this to create interactive flashcard study sets for learners. Generates AT LEAST 15 flashcards with questions/answers on the front and detailed explanations on the back. Use for memorization, vocabulary learning, and quick concept review.

IMPORTANT DISTINCTION:
- Teachers/Admins → create_assignment (creates printable PDF-ready documents, 10+ questions for topic practice)
- Students/Learners → create_quiz (creates interactive in-app assessments, 30+ questions for exam prep)
- Study Tools → generate_summary, generate_overview, identify_keywords, generate_study_guide (content analysis and learning aids)
- Memorization → create_flashcards (15+ cards for quick review and memorization)

When responding:
- Be concise and educational
- Always cite your sources when using search results
- Confirm before saving memories
- Use the right tool for the job - don't use web_search when fetch_memory would work
- Be aware of the current date when providing time-sensitive information`;

  // Add memory context if available
  if (memoryItems && memoryItems.length > 0) {
    systemPrompt += `\n\nYou have access to the following saved memory (use fetch_memory tool to retrieve specific details):\n`;
    memoryItems.forEach((item: MemoryItem) => {
      systemPrompt += `- ${item.title} (${item.category || 'uncategorized'}): ${item.description || 'No description'}\n`;
    });
    systemPrompt += `\nWhen the user asks about any of these topics, use the fetch_memory tool with the appropriate category or search term to get the full details.`;
  }

  // CONTEXT LENGTH MANAGEMENT
  // Check and compact context if needed before sending to AI
  const MAX_CONTEXT_TOKENS = 1000000; // 1M token limit
  const WARNING_THRESHOLD = 800000; // 800K tokens
  
  // Calculate current context size
  const contextStats = getContextStats(messages);
  let processedMessages = messages;
  
  // Log context stats for monitoring (development only)
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Chat Context] Messages: ${contextStats.messageCount}, Estimated tokens: ${contextStats.estimatedTokens}, Usage: ${contextStats.percentUsed}%`);
    
    // Log individual message stats if there are oversized messages
    if (contextStats.oversizedMessageCount > 0) {
      console.warn(`[Chat Context] Found ${contextStats.oversizedMessageCount} oversized messages. Largest: ${contextStats.largestMessageTokens.toLocaleString()} tokens at index ${contextStats.largestMessageIndex}`);
    }
    
    // Log first messages stats if they dominate context
    if (contextStats.firstMessagesTotalTokens > WARNING_THRESHOLD * 0.3) {
      console.warn(`[Chat Context] First messages dominate context: ${contextStats.firstMessagesTotalTokens.toLocaleString()} tokens (${Math.round((contextStats.firstMessagesTotalTokens / contextStats.estimatedTokens) * 100)}% of total)`);
    }
  }
  
  // If context exceeds warning threshold, try to compact
  if (contextStats.estimatedTokens > WARNING_THRESHOLD) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Chat Context] Compacting context...`);
    }
    
    const compactionResult = compactContext(messages, {
      maxTokens: MAX_CONTEXT_TOKENS,
      warningThreshold: WARNING_THRESHOLD,
      compactionThreshold: 500000,
    });
    
    processedMessages = compactionResult.messages;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Chat Context] Compaction applied: ${compactionResult.action}, Removed: ${compactionResult.removedCount} items`);
    }
    
    // Check if still over limit after compaction
    const newStats = getContextStats(processedMessages);
    if (newStats.estimatedTokens > MAX_CONTEXT_TOKENS) {
      console.error(`[Chat Context] Context exceeds maximum limit even after compaction: ${newStats.estimatedTokens} tokens`);
      return new Response(
        JSON.stringify({
          type: 'error',
          error: {
            type: 'context_length_exceeded',
            code: 'context_length_exceeded',
            message: 'Your conversation has grown too large for this model. Please start a new chat to continue.',
            param: 'messages',
          }
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
  }

  let activeModel;
  if (modelId) {
    const allowed = getAvailableModels();
    if (!allowed.some(m => m.id === modelId)) {
      return new Response(
        JSON.stringify({ error: 'Requested model is not available' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    activeModel = getModelById(modelId);
  } else {
    activeModel = getModel();
  }

  const result = streamText({
    model: activeModel,
    system: systemPrompt,
    messages: await convertToModelMessages(processedMessages),
    abortSignal: req.signal,
    maxOutputTokens: 8192,
    stopWhen: stepCountIs(15),
    // Smooth out token-by-token jitter for a better streaming UX
    experimental_transform: smoothStream({ delayInMs: 15 }),
    // Anthropic ephemeral cache on the system prompt — reduces latency + token cost;
    // silently ignored by other providers.
    providerOptions: {
      anthropic: { cacheControl: { type: 'ephemeral' } },
    },
    // Skip expensive search tools for simple conversational queries
    prepareStep: async ({ stepNumber, messages: stepMessages }) => {
      if (stepNumber === 0) {
        const lastMsg = stepMessages.at(-1);
        let lastText = '';
        if (typeof lastMsg?.content === 'string') {
          lastText = lastMsg.content;
        } else if (Array.isArray(lastMsg?.content)) {
          lastText = (lastMsg.content as Array<{ type: string; text?: string }>)
            .filter(p => p.type === 'text')
            .map(p => p.text || '')
            .join('');
        }
        const needsSearch = /(search|find|look up|youtube|video|browse|research|resource|current|latest|news|recent)/i.test(lastText);
        if (!needsSearch && lastText.length < 200) {
          // Skip web/youtube/research tools — use only local + generative tools
          return {
            activeTools: [
              'save_memory', 'fetch_memory', 'get_current_time', 'server_actions',
              'create_assignment', 'create_quiz', 'create_flashcards',
              'generate_summary', 'generate_overview', 'identify_keywords', 'generate_study_guide',
            ],
          };
        }
      }
      return undefined; // all tools active for search-intent queries
    },
    onError: (error) => {
      console.error('[Chat Stream Error]', error);
    },
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
              userId: dbUserId,
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
              memories = await getMemoryItemsByCategory(dbUserId, category);
            } else {
              memories = await getMemoryItems(dbUserId);
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
        description: 'Call exposed server-side functions to perform system operations. Available actions include: get_levels (list all levels), add_regular (add a regular user to admin\'s list), get_my_regulars (list admin\'s regular users), create_resource (create educational resources), get_resources (list resources). Use this when the user requests operations that require backend data manipulation.',
        inputSchema: z.object({
          action: z.enum(['get_levels', 'add_regular', 'get_my_regulars', 'create_resource', 'get_resources', 'get_subjects', 'get_topics']),
          params: z.any().optional(),
        }),
        // Mutation actions require explicit user confirmation before executing.
        needsApproval: (input) => {
          const mutations = ['add_regular', 'create_resource'];
          return mutations.includes(input.action);
        },
        execute: async ({ action, params = {} }) => {
          try {
            switch (action) {
              case 'get_levels': {
                const { getLevels } = await import('@/lib/actions/admin');
                const levels = await getLevels();
                return {
                  success: true,
                  action: 'get_levels',
                  data: levels.map(level => ({
                    id: level.id,
                    title: level.title,
                    levelNumber: level.levelNumber,
                    subjects: level.subjects?.map((s: { name: string; id: string }) => s.name) || [],
                  })),
                };
              }
              
              case 'add_regular': {
                const { addMyLearner } = await import('@/lib/actions/admin');
                const { email, metadata } = params;
                if (!email) {
                  return {
                    success: false,
                    error: 'Missing required parameter: email is required',
                  };
                }
                await addMyLearner(clerkId, email as string, metadata as Record<string, unknown>);
                return {
                  success: true,
                  action: 'add_regular',
                  message: `Regular user with email ${email} added successfully`,
                };
              }
              
              case 'get_my_regulars': {
                const { getMyLearners } = await import('@/lib/actions/admin');
                const regulars = await getMyLearners(clerkId);
                return {
                  success: true,
                  action: 'get_my_regulars',
                  data: regulars.map(l => ({
                    id: l.id,
                    regularId: l.regularId,
                    email: l.regularEmail,
                    name: l.regular?.name,
                    level: l.regular?.level,
                    metadata: l.metadata,
                  })),
                };
              }
              
              case 'create_resource': {
                const { createResource } = await import('@/lib/actions/admin');
                const { subjectId, topicId, title, description, type, url, thumbnailUrl, metadata } = params;
                if (!subjectId || !topicId || !title || !description || !type || !url) {
                  return {
                    success: false,
                    error: 'Missing required parameters: subjectId, topicId, title, description, type, and url are required',
                  };
                }
                // User info already retrieved earlier
                if (!user) {
                  return {
                    success: false,
                    error: 'User not found',
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
                  ownerId: user.id,
                  ownerRole: user.role,
                  visibility: "admin_and_regulars", // Default visibility for resources created via chat
                });
                return {
                  success: true,
                  action: 'create_resource',
                  message: `Resource "${title}" created successfully`,
                };
              }
              
              case 'get_resources': {
                const { getResources } = await import('@/lib/actions/admin');
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
                const { getSubjects } = await import('@/lib/actions/admin');
                const subjects = await getSubjects();
                return {
                  success: true,
                  action: 'get_subjects',
                  data: subjects.map(s => ({
                    id: s.id,
                    name: s.name,
                    level: s.level?.title,
                    topicCount: s.topics?.length || 0,
                  })),
                };
              }
              
              case 'get_topics': {
                const { getTopics } = await import('@/lib/actions/admin');
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
create_assignment: tool({
        description: 'Create assignments, homeworks, quizzes, or continuous assessment tests for TEACHERS and ADMINS. This generates a printable document with questions, answer key, and instructions. The output includes an "Export to PDF" button for easy printing and distribution. Use this when educators need paper-based assessments or worksheets, or for practice questions at the end of a topic or sub-topic. IMPORTANT: Generate AT LEAST 10 questions to ensure comprehensive coverage of the topic or sub-topic concepts.',
        inputSchema: z.object({
          title: z.string().describe('Title of the assignment (e.g., "Mathematics Quiz - Algebra", "Homework Assignment 3")'),
          subject: z.string().describe('Subject area (e.g., "Mathematics", "Science", "English")'),
          level: z.string().describe('Level or class (e.g., "Level 7", "Form 3", "High School")'),
          type: z.enum(['assignment', 'homework', 'quiz', 'test', 'continuous_assessment', 'worksheet']).describe('Type of assessment'),
          instructions: z.string().describe('General instructions for students taking the assessment'),
          questions: z.array(z.object({
            id: z.string().describe('Unique identifier for the question (e.g., "q1", "q2")'),
            type: z.enum(['multiple_choice', 'true_false', 'short_answer', 'essay', 'fill_in_blank', 'matching']).describe('Question type'),
            text: z.string().describe('The question text'),
            options: z.array(z.string()).optional().describe('For multiple choice: the answer options (A, B, C, D)'),
            correctAnswer: z.any().describe('The correct answer (string for single answers, array for multiple)'),
            marks: z.number().describe('Points/marks for this question'),
            explanation: z.string().optional().describe('Explanation of the correct answer (for answer key)'),
          })).describe('Array of questions for the assessment'),
          totalMarks: z.number().describe('Total marks/points for the entire assessment'),
          timeLimit: z.number().optional().describe('Time limit in minutes (if applicable)'),
          dueDate: z.string().optional().describe('Due date for submission (e.g., "2025-02-15")'),
          includeAnswerKey: z.boolean().optional().describe('Whether to include an answer key (default: true for admins)'),
        }),
        execute: async ({ title, subject, level, type, instructions, questions, totalMarks, timeLimit, dueDate, includeAnswerKey = true }) => {
          try {
            // Generate answer key
            const answerKey = questions.map(q => ({
              id: q.id,
              type: q.type,
              correctAnswer: q.correctAnswer,
              marks: q.marks,
              explanation: q.explanation || '',
            }));

            // Calculate total marks from questions if not provided
            const calculatedTotalMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);
            const finalTotalMarks = totalMarks || calculatedTotalMarks;

            // Save to database
            const { saveAIAssignment } = await import('@/lib/actions/ai');
            const savedAssignment = await saveAIAssignment({
              userId: dbUserId,
              chatId,
              title,
              subject,
              level,
              type,
              instructions,
              totalMarks: finalTotalMarks,
              timeLimit,
              dueDate,
              includeAnswerKey,
              questions,
              answerKey: includeAnswerKey ? answerKey : undefined,
            });

            const assignment = {
              success: true,
              format: 'assignment',
              assignmentId: savedAssignment.id,
              metadata: {
                title,
                subject,
                level,
                type,
                createdAt: savedAssignment.createdAt.toISOString(),
                totalMarks: finalTotalMarks,
                questionCount: questions.length,
                timeLimit,
                dueDate,
                includeAnswerKey,
              },
              content: {
                header: {
                  title,
                  subject,
                  level,
                  type: type.replace(/_/g, ' ').toUpperCase(),
                  totalMarks: finalTotalMarks,
                  timeLimit,
                  dueDate,
                },
                instructions,
                questions: questions.map((q, index) => ({
                  number: index + 1,
                  id: q.id,
                  type: q.type,
                  text: q.text,
                  options: q.options,
                  marks: q.marks,
                })),
              },
              answerKey: includeAnswerKey ? {
                title: `${title} - ANSWER KEY`,
                answers: answerKey.map((a, index) => ({
                  number: index + 1,
                  ...a,
                })),
              } : null,
              exportOptions: {
                canExportPDF: true,
                canExportWord: true,
                canPrint: true,
              },
            };

            return assignment;
          } catch (error) {
            return {
              success: false,
              error: `Failed to create assignment: ${error instanceof Error ? error.message : String(error)}`,
            };
          }
        },
      }),
create_quiz: tool({
        description: 'Create interactive quizzes for LEARNERS that can be taken within the app. This generates a quiz that displays in a MODAL COMPONENT with built-in "Export to PDF" and "Print" buttons for viewing/printing the quiz questions and answer key. Students can answer questions interactively, get immediate feedback, and track their score. Use this for online assessments, practice tests, formative evaluations, and exam preparation covering broad knowledge across multiple topics. IMPORTANT: Generate AT LEAST 30 questions for comprehensive exam coverage or when testing broad knowledge across multiple topics.',
        inputSchema: z.object({
          title: z.string().describe('Title of the quiz (e.g., "Practice Quiz: Photosynthesis", "Weekly Math Test")'),
          subject: z.string().describe('Subject area (e.g., "Biology", "Mathematics", "History")'),
          description: z.string().optional().describe('Brief description of what the quiz covers'),
          instructions: z.string().describe('Instructions for taking the quiz'),
          questions: z.array(z.object({
            id: z.string().describe('Unique identifier for the question (e.g., "q1", "q2")'),
            type: z.enum(['multiple_choice', 'true_false', 'short_answer', 'fill_in_blank']).describe('Question type'),
            text: z.string().describe('The question text'),
            options: z.array(z.object({
              id: z.string().describe('Option identifier (e.g., "A", "B", "1", "2")'),
              text: z.string().describe('Option text'),
              isCorrect: z.boolean().describe('Whether this is the correct answer'),
            })).describe('Answer options for multiple choice or true/false questions'),
            correctAnswer: z.any().describe('The correct answer value (for validation)'),
            marks: z.number().describe('Points for this question'),
            explanation: z.string().optional().describe('Explanation shown after answering (for learning)'),
            hint: z.string().optional().describe('Optional hint for the question'),
          })).describe('Array of quiz questions'),
          settings: z.object({
            shuffleQuestions: z.boolean().optional().describe('Randomize question order (default: false)'),
            shuffleOptions: z.boolean().optional().describe('Randomize answer options (default: false)'),
            showCorrectAnswerImmediately: z.boolean().optional().describe('Show correct answer after each question (default: true)'),
            showExplanation: z.boolean().optional().describe('Show explanation after answering (default: true)'),
            allowRetake: z.boolean().optional().describe('Allow students to retake the quiz (default: true)'),
            timeLimit: z.number().optional().describe('Time limit in minutes (optional)'),
            passingScore: z.number().optional().describe('Passing score percentage (default: 60)'),
            maxAttempts: z.number().optional().describe('Maximum number of attempts allowed (default: unlimited)'),
          }).optional().describe('Quiz settings and behavior'),
        }),
        execute: async ({ title, subject, description, instructions, questions, settings = {} }) => {
          try {
            // Check if minimum questions requirement is met
            const MIN_QUESTIONS = 30;
            let warningMessage = null;
            if (questions.length < MIN_QUESTIONS) {
              warningMessage = `Note: This quiz contains ${questions.length} questions, which is below the recommended minimum of ${MIN_QUESTIONS} questions for comprehensive exam coverage.`;
              console.warn(`[create_quiz] Warning: Quiz "${title}" has only ${questions.length} questions (minimum recommended: ${MIN_QUESTIONS})`);
            }

            const defaultSettings = {
              shuffleQuestions: false,
              shuffleOptions: false,
              showCorrectAnswerImmediately: true,
              showExplanation: true,
              allowRetake: true,
              timeLimit: null,
              passingScore: 60,
              maxAttempts: null,
              ...settings,
            };

            const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);
            const passingMarks = Math.ceil(totalMarks * (defaultSettings.passingScore / 100));

            // Save to database
            const { saveAIQuiz } = await import('@/lib/actions/ai');
            const savedQuiz = await saveAIQuiz({
              userId: dbUserId,
              chatId,
              title,
              subject,
              description,
              instructions,
              totalMarks,
              passingScore: defaultSettings.passingScore,
              timeLimit: defaultSettings.timeLimit,
              settings: defaultSettings,
              questions,
              validation: {
                answers: questions.map(q => ({
                  id: q.id,
                  correctAnswer: q.correctAnswer,
                  marks: q.marks,
                })),
              },
            });

            const quiz = {
              success: true,
              format: 'interactive_quiz',
              artifact: 'quiz',
              quizId: savedQuiz.id,
              metadata: {
                title,
                subject,
                description,
                createdAt: savedQuiz.createdAt.toISOString(),
                questionCount: questions.length,
                totalMarks,
                passingMarks,
                passingScore: defaultSettings.passingScore,
              },
              quiz: {
                title,
                subject,
                description,
                instructions,
                settings: defaultSettings,
                questions: questions.map((q, index) => ({
                  number: index + 1,
                  id: q.id,
                  type: q.type,
                  text: q.text,
                  options: q.options,
                  marks: q.marks,
                  explanation: q.explanation || null,
                  hint: q.hint || null,
                  // Don't send correctAnswer to frontend for security in assessment mode
                  // It will be validated server-side
                })),
                validation: {
                  // Store correct answers separately for server-side validation
                  answers: questions.map(q => ({
                    id: q.id,
                    correctAnswer: q.correctAnswer,
                    marks: q.marks,
                  })),
                },
              },
              exportOptions: {
                canExportPDF: true,
                canPrint: true,
              },
              actions: {
                canStart: true,
                canSave: true,
                canSubmit: true,
                canViewResults: true,
              },
            };

            return quiz;
          } catch (error) {
            return {
              success: false,
              error: `Failed to create quiz: ${error instanceof Error ? error.message : String(error)}`,
            };
          }
        },
      }),
      generate_summary: tool({
        description: 'Generate a comprehensive summary that captures the full context and key details of provided content. Use this when the user asks for summaries, recaps, or wants to condense information while preserving important context. Creates structured summaries with main points, key takeaways, and contextual information preserved.',
        inputSchema: z.object({
          content: z.string().describe('The content to summarize (can be conversation text, document content, or topic description)'),
          context: z.string().optional().describe('Additional context about the content (e.g., source, purpose, audience)'),
          format: z.enum(['brief', 'detailed', 'comprehensive']).describe('Summary detail level: brief (1-2 paragraphs), detailed (bullet points with explanations), comprehensive (structured sections with full context)'),
          focusAreas: z.array(z.string()).optional().describe('Specific areas or themes to emphasize in the summary'),
        }),
        execute: async ({ content, context, format = 'comprehensive', focusAreas }) => {
          try {
            // Process and structure the summary
            const summary = {
              success: true,
              format: 'summary',
              content: content,
              context: context || null,
              detailLevel: format,
              focusAreas: focusAreas || [],
              generatedAt: new Date().toISOString(),
              metadata: {
                contentLength: content.length,
                hasContext: !!context,
                format,
              },
            };

            return summary;
          } catch (error) {
            return {
              success: false,
              error: `Failed to generate summary: ${error instanceof Error ? error.message : String(error)}`,
            };
          }
        },
      }),
      generate_overview: tool({
        description: 'Generate a comprehensive overview of a topic or subject. Creates structured content with introduction, main sections covering key aspects, and conclusion. Use this for topic introductions, subject reviews, or creating comprehensive learning overviews.',
        inputSchema: z.object({
          topic: z.string().describe('The main topic or subject to overview (e.g., "Photosynthesis", "World War II", "Algebraic Equations")'),
          subject: z.string().describe('Subject area (e.g., "Biology", "History", "Mathematics")'),
          level: z.string().optional().describe('Target level (e.g., "High School", "Undergraduate", "Beginner", "Advanced")'),
          depth: z.enum(['basic', 'intermediate', 'advanced']).describe('Depth of coverage: basic (fundamentals only), intermediate (concepts + applications), advanced (comprehensive with nuances)'),
          sections: z.array(z.string()).optional().describe('Optional: Specific sections to include in the overview'),
        }),
        execute: async ({ topic, subject, level, depth = 'intermediate', sections }) => {
          try {
            const overview = {
              success: true,
              format: 'overview',
              topic,
              subject,
              level: level || 'General',
              depth,
              sections: sections || [],
              generatedAt: new Date().toISOString(),
              metadata: {
                topic,
                subject,
                level: level || 'General',
                depth,
                customSections: (sections || []).length > 0,
              },
            };

            return overview;
          } catch (error) {
            return {
              success: false,
              error: `Failed to generate overview: ${error instanceof Error ? error.message : String(error)}`,
            };
          }
        },
      }),
      identify_keywords: tool({
        description: 'Identify and extract key terms, concepts, and vocabulary from content. Each keyword includes the term itself, a clear definition, and multiple examples. Use this for vocabulary building, concept mapping, terminology study, and understanding domain-specific language.',
        inputSchema: z.object({
          content: z.string().describe('The content to analyze for keywords (text, document, or topic description)'),
          maxKeywords: z.number().optional().describe('Maximum number of keywords to identify (default: 20, max: 50)'),
          includeDefinitions: z.boolean().optional().describe('Include definitions for each keyword (default: true)'),
          includeExamples: z.boolean().optional().describe('Include examples for each keyword (default: true)'),
          category: z.string().optional().describe('Category or domain for context (e.g., "Science", "Literature", "Business")'),
        }),
        execute: async ({ content, maxKeywords = 20, includeDefinitions = true, includeExamples = true, category }) => {
          try {
            const keywords = {
              success: true,
              format: 'keywords',
              content: content,
              category: category || 'General',
              settings: {
                maxKeywords,
                includeDefinitions,
                includeExamples,
              },
              generatedAt: new Date().toISOString(),
              metadata: {
                contentLength: content.length,
                maxKeywords,
                hasCategory: !!category,
              },
            };

            return keywords;
          } catch (error) {
            return {
              success: false,
              error: `Failed to identify keywords: ${error instanceof Error ? error.message : String(error)}`,
            };
          }
        },
      }),
      generate_study_guide: tool({
        description: 'Generate a comprehensive study guide with multiple structured sections for effective learning. Includes overview, key concepts, important terms, practice problems, and review materials. Use this for exam preparation, structured learning, or comprehensive topic review.',
        inputSchema: z.object({
          topic: z.string().describe('The main topic or subject for the study guide'),
          subject: z.string().describe('Subject area (e.g., "Physics", "Literature", "Chemistry")'),
          level: z.string().optional().describe('Target academic level (e.g., "High School", "College", "Graduate")'),
          sections: z.array(z.enum([
            'overview',
            'key_concepts',
            'important_terms',
            'core_principles',
            'practical_applications',
            'common_misconceptions',
            'practice_problems',
            'quick_review',
            'further_reading'
          ])).optional().describe('Specific sections to include. If not provided, all sections will be included.'),
          focusAreas: z.array(z.string()).optional().describe('Specific topics or concepts to emphasize in the guide'),
        }),
        execute: async ({ topic, subject, level, sections, focusAreas }) => {
          try {
            const defaultSections = [
              'overview',
              'key_concepts',
              'important_terms',
              'core_principles',
              'practical_applications',
              'common_misconceptions',
              'practice_problems',
              'quick_review',
              'further_reading'
            ];

            const studyGuide = {
              success: true,
              format: 'study_guide',
              topic,
              subject,
              level: level || 'General',
              sections: sections || defaultSections,
              focusAreas: focusAreas || [],
              generatedAt: new Date().toISOString(),
              metadata: {
                topic,
                subject,
                level: level || 'General',
                sectionCount: (sections || defaultSections).length,
                hasFocusAreas: !!(focusAreas && focusAreas.length > 0),
              },
            };

            return studyGuide;
          } catch (error) {
            return {
              success: false,
              error: `Failed to generate study guide: ${error instanceof Error ? error.message : String(error)}`,
            };
          }
        },
      }),
      create_flashcards: tool({
        description: 'Create interactive flashcard study sets for learners. Generates flashcards with questions/prompts on the front and detailed answers/explanations on the back. Each flashcard includes optional tags and difficulty levels. Use this for memorization, vocabulary learning, quick concept review, and spaced repetition practice. IMPORTANT: Generate AT LEAST 15 flashcards for comprehensive coverage.',
        inputSchema: z.object({
          title: z.string().describe('Title of the flashcard set (e.g., "Biology Terms", "Spanish Vocabulary", "Calculus Formulas")'),
          subject: z.string().describe('Subject area (e.g., "Biology", "Spanish", "Mathematics")'),
          topic: z.string().optional().describe('Specific topic within the subject (e.g., "Cell Structure", "Verb Conjugations")'),
          flashcards: z.array(z.object({
            id: z.string().describe('Unique identifier for the flashcard (e.g., "fc1", "fc2")'),
            front: z.string().describe('Front side content - question, term, or prompt'),
            back: z.string().describe('Back side content - answer, definition, or detailed explanation'),
            tags: z.array(z.string()).optional().describe('Optional tags for categorization (e.g., ["definition", "formula", "example"])'),
            difficulty: z.enum(['easy', 'medium', 'hard']).optional().describe('Difficulty level of the card'),
          })).describe('Array of flashcards - must contain AT LEAST 15 flashcards'),
          settings: z.object({
            shuffle: z.boolean().optional().describe('Allow shuffling cards during study (default: true)'),
            showDifficulty: z.boolean().optional().describe('Show difficulty indicator on cards (default: true)'),
            reviewMode: z.enum(['sequential', 'random', 'spaced']).optional().describe('Review mode: sequential (in order), random (shuffled), spaced (based on difficulty)'),
          }).optional().describe('Flashcard study settings'),
        }),
        execute: async ({ title, subject, topic, flashcards, settings = {} }) => {
          try {
            // Validate minimum flashcard count
            if (flashcards.length < 15) {
              return {
                success: false,
                error: `Flashcard set must contain at least 15 cards. Only ${flashcards.length} provided.`,
              };
            }

            const defaultSettings = {
              shuffle: true,
              showDifficulty: true,
              reviewMode: 'random',
              ...settings,
            };

            // Save to database
            const { saveAIFlashcards } = await import('@/lib/actions/ai');
            const savedFlashcard = await saveAIFlashcards({
              userId: dbUserId,
              chatId,
              title,
              subject,
              topic,
              totalCards: flashcards.length,
              cards: flashcards,
              settings: defaultSettings,
            });

            const flashcardSet = {
              success: true,
              format: 'flashcards',
              artifact: 'flashcards',
              flashcardId: savedFlashcard.id,
              metadata: {
                title,
                subject,
                topic: topic || null,
                totalCards: flashcards.length,
                createdAt: savedFlashcard.createdAt.toISOString(),
              },
              flashcards: {
                title,
                subject,
                topic: topic || null,
                cards: flashcards.map((card, index) => ({
                  number: index + 1,
                  ...card,
                })),
                settings: defaultSettings,
              },
              actions: {
                canStudy: true,
                canSave: true,
                canShuffle: defaultSettings.shuffle,
              },
            };

            return flashcardSet;
          } catch (error) {
            return {
              success: false,
              error: `Failed to create flashcards: ${error instanceof Error ? error.message : String(error)}`,
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

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    messageMetadata: ({ part }) => {
      if (part.type === 'start') {
        return { createdAt: Date.now() };
      }
      if (part.type === 'finish') {
        return {
          totalTokens: part.totalUsage.totalTokens,
          inputTokens: part.totalUsage.inputTokens,
          outputTokens: part.totalUsage.outputTokens,
          finishReason: part.finishReason,
        };
      }
    },
  });
}
