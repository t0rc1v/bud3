import { streamText, UIMessage, convertToModelMessages, stepCountIs, smoothStream } from 'ai';
import { auth } from '@clerk/nextjs/server';
import { getModel, getModelById, getAvailableModels } from '@/lib/ai/providers';
import { checkRateLimit } from '@/lib/rate-limit';
import { getUserByClerkId } from '@/lib/actions/auth';
import { getTokenCache } from '@/lib/ai/token-cache';
import { compactContext, getContextStats } from '@/lib/ai/context-compaction';
import { buildToolSet, LOCAL_TOOL_NAMES } from '@/lib/ai/tools/index';
import type { ToolContext } from '@/lib/ai/tools/types';

// Suppress unused-import warning — getTokenCache may be used at runtime
void getTokenCache;

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
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  // Parallelize user lookup and body parse
  const [user, body] = await Promise.all([
    getUserByClerkId(clerkId),
    req.json() as Promise<{
      messages: UIMessage[];
      chatId?: string;
      modelId?: string;
      tutorMode?: 'socratic' | 'guided' | 'practice';
      tutorSessionId?: string;
      subject?: string;
      topic?: string;
      language?: string;
    }>,
  ]);
  const { messages, chatId, modelId, tutorMode, tutorSessionId, subject: tutorSubject, topic: tutorTopic, language } = body;

  if (!user) {
    return new Response('User not found', { status: 404 });
  }
  const dbUserId = user.id;

  // ── Credit check ──────────────────────────────────────────────
  try {
    const { checkAndDeductCreditsForAIResponse } = await import(
      '@/lib/actions/credits'
    );
    const creditCheck = await checkAndDeductCreditsForAIResponse(
      dbUserId,
      chatId
    );

    if (!creditCheck.success) {
      return new Response(
        JSON.stringify({
          error: creditCheck.error || 'Insufficient credits',
          type: 'INSUFFICIENT_CREDITS',
          remainingCredits: creditCheck.remainingCredits,
        }),
        { status: 402, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error checking credits:', error);
  }

  // ── Persist user message ──────────────────────────────────────
  if (chatId && messages.length > 0) {
    try {
      const { saveChatMessage } = await import('@/lib/actions/ai');
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        let contentStr = '';
        const attachedResources: Array<{
          id: string;
          title: string;
          url: string;
          type: string;
        }> = [];

        if (lastMessage.parts && Array.isArray(lastMessage.parts)) {
          lastMessage.parts.forEach(
            (part: {
              type: string;
              text?: string;
              filename?: string;
              url?: string;
              mediaType?: string;
            }) => {
              if (part.type === 'text') {
                contentStr += part.text || '';
              } else if (part.type === 'file') {
                attachedResources.push({
                  id: part.filename || 'unknown',
                  title: part.filename || 'Attached file',
                  url: part.url || '',
                  type: part.mediaType?.startsWith('image/')
                    ? 'image'
                    : part.mediaType === 'application/pdf'
                      ? 'notes'
                      : 'file',
                });
              }
            }
          );
        }

        if (contentStr.trim()) {
          await saveChatMessage({
            chatId,
            role: 'user',
            content: contentStr,
            metadata:
              attachedResources.length > 0
                ? { attachedResources }
                : undefined,
          });
        }
      }
    } catch (error) {
      console.error('Failed to save user message:', error);
    }
  }

  // ── Load memory context ───────────────────────────────────────
  let memoryItems: MemoryItem[] = [];
  try {
    const { getMemoryItems } = await import('@/lib/actions/ai');
    memoryItems = await getMemoryItems(dbUserId);
  } catch (error) {
    console.error('Failed to load memory items:', error);
  }

  // ── Build system prompt ───────────────────────────────────────
  const now = new Date();
  const currentDateTime = now.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

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

16. create_notes_document - Use this to create a comprehensive, rich study notes document from selected resources, YouTube videos, and images. Produces a beautifully structured document with sections, key terms, embedded media references, and a summary. Best workflow: call youtube_search first to find relevant videos, then call web_search to find supplementary images, then call create_notes_document with those results. Use when:
   - A learner wants comprehensive study notes on a topic
   - Generating a reference document combining text, videos, and visuals
   - Creating a study guide that goes beyond a simple outline
   MINIMUM: 4 sections (introduction, main content, summary, practice), 8 key terms, rich markdown content (150+ words per section).

17. create_exam - Use this to generate a new original exam by analysing past papers or source material. Produces a structured exam with multiple sections, various question types, and an optional answer key — exported as a printable PDF. Use when:
   - An admin or teacher wants to generate a new exam based on past-paper patterns
   - Creating an end-of-term/end-of-year paper
   - Building a mock exam from topic coverage
   MINIMUM: 40 total marks, 3 sections, mix of question types (multiple_choice, true_false, short_answer, essay, structured).

18. read_resource_content - Use this to read the full text content of a specific platform resource by its ID. Extracts text from PDFs server-side. Supports pagination for large documents via startOffset/maxCharacters. Use when:
   - A user asks you to summarize, analyze, or create study material from an attached resource
   - You need to read the content of a specific resource referenced in the conversation
   - You need to paginate through a large document (check hasMore flag)

19. search_resource_content - Use this to search across all platform resources the user can access. Returns matching resources with excerpts. Use when:
   - The user asks to "find resources about X" within the platform
   - You need to locate resources on a specific topic before reading them
   - Building study materials from multiple resources on a topic
   After searching, use read_resource_content on specific results to get full content.

IMPORTANT DISTINCTION:
- Teachers/Admins → create_assignment (creates printable PDF-ready documents, 10+ questions for topic practice)
- Teachers/Admins → create_exam (generates structured exam papers from past-paper analysis, 40+ marks, answer key)
- Students/Learners → create_quiz (creates interactive in-app assessments, 30+ questions for exam prep)
- Study Tools → generate_summary, generate_overview, identify_keywords, generate_study_guide (content analysis and learning aids)
- Memorization → create_flashcards (15+ cards for quick review and memorization)
- Rich Study Notes → create_notes_document (comprehensive multi-section document with media, terms, and summary)
- Resource Content → read_resource_content (read full text of a platform resource by ID), search_resource_content (search across platform resources)

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

  // ── Tutor mode: swap system prompt ────────────────────────────
  if (tutorMode && tutorSubject && tutorTopic) {
    const { buildSocraticPrompt, buildGuidedPrompt, buildPracticePrompt } = await import('@/lib/ai/tutor-prompts');
    const tutorPrompt =
      tutorMode === 'socratic' ? buildSocraticPrompt(tutorSubject, tutorTopic) :
      tutorMode === 'guided' ? buildGuidedPrompt(tutorSubject, tutorTopic) :
      buildPracticePrompt(tutorSubject, tutorTopic);
    systemPrompt += '\n\n' + tutorPrompt;
  }

  // ── Language instruction ──────────────────────────────────────
  if (language && language !== 'en') {
    const { buildLanguageInstruction } = await import('@/lib/ai/language');
    systemPrompt += buildLanguageInstruction(language);
  }

  // ── Context length management ─────────────────────────────────
  const MAX_CONTEXT_TOKENS = 1000000;
  const WARNING_THRESHOLD = 800000;

  const contextStats = getContextStats(messages);
  let processedMessages = messages;

  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[Chat Context] Messages: ${contextStats.messageCount}, Estimated tokens: ${contextStats.estimatedTokens}, Usage: ${contextStats.percentUsed}%`
    );
    if (contextStats.oversizedMessageCount > 0) {
      console.warn(
        `[Chat Context] Found ${contextStats.oversizedMessageCount} oversized messages. Largest: ${contextStats.largestMessageTokens.toLocaleString()} tokens at index ${contextStats.largestMessageIndex}`
      );
    }
    if (contextStats.firstMessagesTotalTokens > WARNING_THRESHOLD * 0.3) {
      console.warn(
        `[Chat Context] First messages dominate context: ${contextStats.firstMessagesTotalTokens.toLocaleString()} tokens (${Math.round((contextStats.firstMessagesTotalTokens / contextStats.estimatedTokens) * 100)}% of total)`
      );
    }
  }

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
      console.log(
        `[Chat Context] Compaction applied: ${compactionResult.action}, Removed: ${compactionResult.removedCount} items`
      );
    }

    const newStats = getContextStats(processedMessages);
    if (newStats.estimatedTokens > MAX_CONTEXT_TOKENS) {
      console.error(
        `[Chat Context] Context exceeds maximum limit even after compaction: ${newStats.estimatedTokens} tokens`
      );
      return new Response(
        JSON.stringify({
          type: 'error',
          error: {
            type: 'context_length_exceeded',
            code: 'context_length_exceeded',
            message:
              'Your conversation has grown too large for this model. Please start a new chat to continue.',
            param: 'messages',
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // ── Model selection ───────────────────────────────────────────
  let activeModel;
  if (modelId) {
    const allowed = getAvailableModels();
    if (!allowed.some((m) => m.id === modelId)) {
      return new Response(
        JSON.stringify({ error: 'Requested model is not available' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    activeModel = getModelById(modelId);
  } else {
    activeModel = getModel();
  }

  // ── Build tools from modular registry ─────────────────────────
  const ctx: ToolContext = {
    dbUserId,
    clerkId,
    user: { id: user.id, role: user.role, email: user.email },
    chatId,
    language,
    tutorSessionId,
  };

  const tools = buildToolSet(ctx);

  // ── Stream ────────────────────────────────────────────────────
  const result = streamText({
    model: activeModel,
    system: systemPrompt,
    messages: await convertToModelMessages(processedMessages),
    abortSignal: req.signal,
    maxOutputTokens: 8192,
    stopWhen: stepCountIs(15),
    experimental_transform: smoothStream({ delayInMs: 15 }),
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
          lastText = (
            lastMsg.content as Array<{ type: string; text?: string }>
          )
            .filter((p) => p.type === 'text')
            .map((p) => p.text || '')
            .join('');
        }
        const needsSearch =
          /(search|find|look up|youtube|video|browse|research|resource|current|latest|news|recent)/i.test(
            lastText
          );
        if (!needsSearch && lastText.length < 200) {
          return { activeTools: [...LOCAL_TOOL_NAMES] };
        }
      }
      return undefined;
    },
    onError: (error) => {
      console.error('[Chat Stream Error]', error);
    },
    tools,
    onFinish: async ({ response }) => {
      if (chatId) {
        try {
          const { saveChatMessage } = await import('@/lib/actions/ai');

          const toolResultsById = new Map<string, unknown>();
          const toolMessages = response.messages.filter(
            (m) => m.role === 'tool'
          );

          for (const toolMessage of toolMessages) {
            if (Array.isArray(toolMessage.content)) {
              for (const part of toolMessage.content as Array<{
                type: string;
                toolCallId?: string;
                toolName?: string;
                output?: unknown;
                result?: unknown;
              }>) {
                if (part.type === 'tool-result' && part.toolCallId) {
                  const output =
                    part.output !== undefined ? part.output : part.result;
                  toolResultsById.set(part.toolCallId, output);
                }
              }
            }
          }

          const assistantMessages = response.messages.filter(
            (m) => m.role === 'assistant'
          );

          for (const assistantMessage of assistantMessages) {
            let contentStr = '';
            const toolCallsWithResults: Array<{
              toolCallId: string;
              toolName: string;
              input: unknown;
              output?: unknown;
            }> = [];

            if (Array.isArray(assistantMessage.content)) {
              for (const part of assistantMessage.content as Array<{
                type: string;
                text?: string;
                toolCallId?: string;
                toolName?: string;
                input?: unknown;
                args?: unknown;
              }>) {
                if (part.type === 'text') {
                  contentStr += part.text || '';
                } else if (part.type === 'tool-call') {
                  const toolCallId = part.toolCallId || '';
                  const output = toolResultsById.get(toolCallId);
                  const input =
                    part.input !== undefined ? part.input : part.args;

                  toolCallsWithResults.push({
                    toolCallId,
                    toolName: part.toolName || 'unknown',
                    input: input || {},
                    output,
                  });
                }
              }
            } else if (typeof assistantMessage.content === 'string') {
              contentStr = assistantMessage.content;
            }

            const metadata: Record<string, unknown> = {};
            if (toolCallsWithResults.length > 0) {
              metadata.toolCalls = toolCallsWithResults;
            }

            await saveChatMessage({
              chatId,
              role: 'assistant',
              content: contentStr,
              metadata:
                Object.keys(metadata).length > 0 ? metadata : undefined,
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
