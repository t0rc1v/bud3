import { streamText, UIMessage, convertToModelMessages, stepCountIs, smoothStream } from 'ai';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { getModel, getModelById, getAvailableModels } from '@/lib/ai/providers';
import { checkRateLimit } from '@/lib/rate-limit';
import { getUserByClerkId } from '@/lib/actions/auth';
import { getTokenCache } from '@/lib/ai/token-cache';
import { compactContext, getContextStats } from '@/lib/ai/context-compaction';
import { buildToolSet, buildToolSetWithRouter, LOCAL_TOOL_NAMES } from '@/lib/ai/tools/index';
import type { ToolContext } from '@/lib/ai/tools/types';
import { createAgentPrepareStep } from '@/lib/ai/agents/prepare-step';
import { getAgentsForRole } from '@/lib/ai/agents/registry';

const chatRequestSchema = z.object({
  messages: z.array(z.object({
    id: z.string(),
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().optional(),
    parts: z.array(z.any()).optional(),
  })).min(1, "At least one message is required"),
  chatId: z.string().optional(),
  modelId: z.string().optional(),
  tutorMode: z.enum(['socratic', 'guided', 'practice']).optional(),
  tutorSessionId: z.string().optional(),
  subject: z.string().optional(),
  topic: z.string().optional(),
  language: z.string().optional(),
});

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
  const [user, rawBody] = await Promise.all([
    getUserByClerkId(clerkId),
    req.json(),
  ]);
  const parsed = chatRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0]?.message || 'Invalid request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const body = parsed.data;
  const { messages: rawMessages, chatId, modelId, tutorMode, tutorSessionId, subject: tutorSubject, topic: tutorTopic, language } = body;
  const messages = rawMessages as UIMessage[];

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
      chatId,
      modelId
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

## Tool Usage Rules
- Admins/Teachers: use create_assignment (printable, 10+ questions) or create_exam (structured exam, 40+ marks, 3+ sections) for assessments.
- Students/Learners: use create_quiz (interactive in-app, EXACTLY 30 questions — no exceptions).
- youtube_search: ONLY for explicit video requests — never for general information.
- fetch_memory before web_search when the user asks about previously saved info.
- For study notes: youtube_search → web_search → create_notes_document workflow.
- For platform content: search_resource_content → read_resource_content workflow.

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

  const agentRoutingEnabled = process.env.AGENT_ROUTING === 'true';
  const tools = agentRoutingEnabled
    ? buildToolSetWithRouter(ctx)
    : buildToolSet(ctx);

  // ── Build system prompt or router prompt ────────────────────
  let activeSystemPrompt = systemPrompt;
  let activePrepareStep;

  if (agentRoutingEnabled) {
    // Router system prompt: short, lists agent options
    const availableAgents = getAgentsForRole(ctx.user.role);
    const agentList = availableAgents
      .map((a) => `- **${a.name}** (\`${a.id}\`): ${a.description}`)
      .join('\n');

    const routerSystemPrompt = `You are a helpful AI assistant for an educational platform called Bud.
Current date and time: ${currentDateTime}

You route user requests to specialist agents using the delegate_to_agent tool.

## Available Agents
${agentList}

## Instructions
1. Analyze the user's message to determine which specialist agent can best handle it.
2. Call delegate_to_agent with the appropriate agent ID and a clear task description.
3. Include all relevant context from the user's message in the task.
4. For simple greetings or questions you can answer directly (like "hello" or "what time is it"), respond without delegating.
5. If the request spans multiple domains or doesn't fit any agent, delegate to \`general\`.
6. You also have access to save_memory, fetch_memory, get_current_time, server_actions, and translate_content at all times.

${memoryItems.length > 0 ? `\nYou have saved memories:\n${memoryItems.map((item: MemoryItem) => `- ${item.title} (${item.category || 'uncategorized'}): ${item.description || 'No description'}`).join('\n')}\nUse fetch_memory to retrieve full details when relevant.` : ''}`;

    activeSystemPrompt = routerSystemPrompt;

    // Append tutor mode and language to router prompt too
    if (tutorMode && tutorSubject && tutorTopic) {
      const { buildSocraticPrompt, buildGuidedPrompt, buildPracticePrompt } = await import('@/lib/ai/tutor-prompts');
      const tutorPrompt =
        tutorMode === 'socratic' ? buildSocraticPrompt(tutorSubject, tutorTopic) :
        tutorMode === 'guided' ? buildGuidedPrompt(tutorSubject, tutorTopic) :
        buildPracticePrompt(tutorSubject, tutorTopic);
      activeSystemPrompt += '\n\n' + tutorPrompt;
    }
    if (language && language !== 'en') {
      const { buildLanguageInstruction } = await import('@/lib/ai/language');
      activeSystemPrompt += buildLanguageInstruction(language);
    }

    const allToolNames = Object.keys(tools);
    activePrepareStep = createAgentPrepareStep(
      systemPrompt,
      allToolNames,
      [...LOCAL_TOOL_NAMES]
    );
  } else {
    // Original prepareStep: skip expensive search tools for simple queries
    activePrepareStep = async ({ stepNumber, messages: stepMessages }: { stepNumber: number; messages: Array<{ role: string; content: unknown }> }) => {
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
    };
  }

  // ── Stream ────────────────────────────────────────────────────
  const result = streamText({
    model: activeModel,
    system: activeSystemPrompt,
    messages: await convertToModelMessages(processedMessages),
    abortSignal: req.signal,
    maxOutputTokens: 8192,
    stopWhen: stepCountIs(15),
    experimental_transform: smoothStream({ delayInMs: 15 }),
    providerOptions: {
      anthropic: { cacheControl: { type: 'ephemeral' } },
    },
    prepareStep: activePrepareStep,
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
