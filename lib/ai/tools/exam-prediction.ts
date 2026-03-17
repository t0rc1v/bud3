import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types';

export function predictExamTopicsTool(_ctx: ToolContext) {
  return tool({
    description:
      'Predict likely exam topics by analyzing patterns across stored exams and past papers for a given subject. Returns topic frequency and confidence scores.',
    inputSchema: z.object({
      subject: z.string().describe('Subject to analyze (e.g., "Biology", "Mathematics")'),
      level: z.string().optional().describe('Academic level filter'),
    }),
    execute: async ({ subject, level }) => {
      try {
        const { getPredictedTopics } = await import('@/lib/actions/exam-prediction');
        const predictions = await getPredictedTopics(subject, level);
        return { success: true, ...predictions };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  });
}
