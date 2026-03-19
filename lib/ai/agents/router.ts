import { tool } from 'ai';
import { z } from 'zod';
import { getAgent, getAgentsForRole } from './registry';
import type { AgentId } from './types';

/**
 * Build the delegate_to_agent tool, scoped to the user's role.
 * The router calls this to hand off to a specialist agent.
 */
export function buildDelegateToAgentTool(userRole: string) {
  const available = getAgentsForRole(userRole);
  const validIds = available.map((a) => a.id);

  return tool({
    description: `Delegate the user's request to a specialist agent. Available agents: ${available.map((a) => `${a.id} (${a.name}: ${a.description})`).join('; ')}`,
    inputSchema: z.object({
      agent: z
        .string()
        .describe('The agent ID to delegate to'),
      task: z
        .string()
        .describe(
          'A clear, self-contained description of what the agent should do. Include all relevant context from the conversation.'
        ),
    }),
    execute: async ({ agent, task }: { agent: string; task: string }) => {
      // Validate agent is accessible
      if (!validIds.includes(agent as AgentId) && agent !== 'general') {
        return {
          delegated: false,
          error: `Agent "${agent}" is not available. Choose from: ${validIds.join(', ')}`,
        };
      }

      const agentDef = getAgent(agent as AgentId);
      if (!agentDef) {
        return {
          delegated: false,
          error: `Unknown agent "${agent}".`,
        };
      }

      return {
        delegated: true,
        agent: agentDef.id,
        agentName: agentDef.name,
        task,
      };
    },
  });
}
