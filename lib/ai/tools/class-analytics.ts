import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types';

export function queryClassAnalyticsTool(ctx: ToolContext) {
  return tool({
    description:
      'Query class-level analytics: average scores, pass rates, topic difficulty, and student performance distribution. Use natural language to describe what data you need.',
    inputSchema: z.object({
      query: z.string().describe('Natural language description of the analytics needed (e.g., "average quiz scores by subject", "which students are falling behind")'),
    }),
    execute: async ({ query }) => {
      try {
        // Route to the right analytics function based on query intent
        const queryLower = query.toLowerCase();

        if (queryLower.includes('class') || queryLower.includes('roster') || queryLower.includes('student')) {
          const { getClassPerformance } = await import('@/lib/actions/teacher-analytics');
          const data = await getClassPerformance(ctx.clerkId);
          return { success: true, type: 'class_performance', data };
        }

        if (queryLower.includes('topic') || queryLower.includes('difficulty') || queryLower.includes('subject')) {
          const { getTopicDifficulty } = await import('@/lib/actions/teacher-analytics');
          const data = await getTopicDifficulty();
          return { success: true, type: 'topic_difficulty', data };
        }

        // Default: return both
        const { getClassPerformance, getTopicDifficulty } = await import('@/lib/actions/teacher-analytics');
        const [classData, topicData] = await Promise.all([
          getClassPerformance(ctx.clerkId),
          getTopicDifficulty(),
        ]);

        return {
          success: true,
          type: 'combined',
          classPerformance: classData,
          topicDifficulty: topicData,
        };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  });
}
