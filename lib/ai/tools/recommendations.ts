import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types';

export function getRecommendationsTool(ctx: ToolContext) {
  return tool({
    description: 'Get personalized resource recommendations for the current student based on their learning history, ratings, and weak topics.',
    inputSchema: z.object({
      limit: z.number().optional().describe('Number of recommendations (default: 10)'),
    }),
    execute: async ({ limit = 10 }) => {
      try {
        const { getRecommendations } = await import('@/lib/actions/recommendations');
        const recommendations = await getRecommendations(ctx.dbUserId, limit);
        return { success: true, recommendations, count: recommendations.length };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  });
}
