import { readFileSync } from 'fs';
import { join } from 'path';
import type { AgentId } from './types';
import { ALWAYS_AVAILABLE_TOOLS } from './types';
import { getAgent } from './registry';

/** Module-level cache for skill file contents */
const skillCache = new Map<string, string>();

function loadSkill(skillFile: string): string {
  if (!skillFile) return '';
  const cached = skillCache.get(skillFile);
  if (cached) return cached;

  try {
    const fullPath = join(process.cwd(), skillFile);
    const content = readFileSync(fullPath, 'utf-8');
    skillCache.set(skillFile, content);
    return content;
  } catch (error) {
    console.error(`[Agent] Failed to load skill file: ${skillFile}`, error);
    return '';
  }
}

/**
 * Extract text from the last message in a step's message array.
 */
function getLastMessageText(
  messages: Array<{ role: string; content: unknown }>
): string {
  const lastMsg = messages.at(-1);
  if (!lastMsg) return '';
  if (typeof lastMsg.content === 'string') return lastMsg.content;
  if (Array.isArray(lastMsg.content)) {
    return (lastMsg.content as Array<{ type: string; text?: string }>)
      .filter((p) => p.type === 'text')
      .map((p) => p.text || '')
      .join('');
  }
  return '';
}

/**
 * Check if the last tool call in messages was a successful delegate_to_agent.
 * Returns the delegated agent ID if found, otherwise null.
 */
function findDelegation(
  messages: Array<{ role: string; content: unknown }>
): { agentId: AgentId; task: string } | null {
  // Walk backwards to find the most recent tool result for delegate_to_agent
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'tool' && Array.isArray(msg.content)) {
      for (const part of msg.content as Array<{
        type: string;
        toolName?: string;
        result?: { delegated?: boolean; agent?: string; task?: string };
        output?: { delegated?: boolean; agent?: string; task?: string };
      }>) {
        if (part.type === 'tool-result') {
          const result = part.result ?? part.output;
          if (result?.delegated === true && result.agent) {
            return {
              agentId: result.agent as AgentId,
              task: result.task || '',
            };
          }
        }
      }
    }
  }
  return null;
}

interface PrepareStepParams {
  stepNumber: number;
  messages: Array<{ role: string; content: unknown }>;
}

interface PrepareStepResult {
  activeTools?: string[];
  system?: string;
}

/**
 * Create a prepareStep function that handles agent routing.
 *
 * - Step 0: Router mode — only always-available tools shown
 * - After delegate_to_agent: loads specialist agent's tools + skill instructions
 * - Simple queries (< 200 chars, no search keywords): bypass routing, use local tools
 *
 * @param baseSystemPrompt The original full system prompt (used for general fallback)
 * @param allToolNames All tool names in the full tool set (for general fallback)
 * @param localToolNames Tool names that don't require web access
 */
export function createAgentPrepareStep(
  baseSystemPrompt: string,
  allToolNames: string[],
  localToolNames: string[]
) {
  let activeAgentId: AgentId | null = null;
  let onFastPath = false;

  const RETRY_GUIDANCE = `\n\n## Tool Error Handling\nTools automatically retry transient errors (timeout, network, rate limit) before returning. If you receive an error, all retries are already exhausted — do NOT retry transient failures yourself. Instead:\n- Transient errors: inform the user the service is temporarily unavailable.\n- Empty or no results: rephrase the query and try again (this is fine — it's a different query, not a retry).\n- Permission/validation errors: do NOT retry, inform the user.\n\nIMPORTANT: Do NOT delegate to another agent when a tool fails.`;

  return async ({
    stepNumber,
    messages,
  }: PrepareStepParams): Promise<PrepareStepResult | undefined> => {
    // Check if a delegation happened in the latest messages
    const delegation = findDelegation(messages);
    if (delegation) {
      activeAgentId = delegation.agentId;
      onFastPath = false;
    }

    // Step 0 (no delegation yet): router mode
    if (stepNumber === 0 && !activeAgentId) {
      // Fast-path: simple conversational queries skip routing entirely
      const lastText = getLastMessageText(messages);
      const needsSearch =
        /(search|find|look up|youtube|video|browse|research|resource|current|latest|news|recent)/i.test(
          lastText
        );
      if (!needsSearch && lastText.length < 200) {
        onFastPath = true;
        // Simple query: give local tools directly, no routing overhead
        return {
          activeTools: [...localToolNames],
          system: RETRY_GUIDANCE,
        };
      }

      // Complex query: show only router tools so the LLM delegates
      return {
        activeTools: [...ALWAYS_AVAILABLE_TOOLS],
      };
    }

    // Fast-path follow-up: keep local tools, don't allow delegation.
    // This prevents the AI from delegating after a tool error instead of retrying.
    if (onFastPath && !activeAgentId) {
      return {
        activeTools: [...localToolNames],
        system: RETRY_GUIDANCE,
      };
    }

    // Active agent: load its tools and skill
    if (activeAgentId) {
      // General fallback: all tools, original system prompt
      if (activeAgentId === 'general') {
        return undefined; // Use all tools + original system prompt
      }

      const agentDef = getAgent(activeAgentId);
      if (!agentDef) {
        // Unknown agent, fall back to all tools
        return undefined;
      }

      const skillContent = loadSkill(agentDef.skillFile);
      const agentTools = [
        ...ALWAYS_AVAILABLE_TOOLS,
        ...agentDef.toolNames,
      ];

      const result: PrepareStepResult = {
        activeTools: agentTools,
      };

      result.system = (skillContent || '') + RETRY_GUIDANCE;

      return result;
    }

    // No agent active and not step 0 — shouldn't happen, but fall back safely
    return undefined;
  };
}
