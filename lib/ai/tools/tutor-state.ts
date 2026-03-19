import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types';

export function updateTutorProgressTool(ctx: ToolContext) {
  return tool({
    description:
      'Records a student response in the current tutor session and returns server-tracked progress counters. ' +
      'Call this after evaluating each student answer. The returned flags tell you what pedagogical action to take.',
    inputSchema: z.object({
      action: z
        .enum(['correct', 'incorrect', 'attempt', 'new_question'])
        .describe(
          'correct: student answered correctly (resets wrongStreak, increments correctStreak). ' +
          'incorrect: student answered incorrectly (resets correctStreak, increments wrongStreak). ' +
          'attempt: student made an attempt at the current question without a definitive right/wrong (Socratic mode — increments attemptCount). ' +
          'new_question: you are moving to a new question (resets attemptCount).'
        ),
    }),
    execute: async ({ action }) => {
      if (!ctx.chatId) {
        return { success: false, error: 'No chat session — tutor progress tracking unavailable.' };
      }

      try {
        const { getTutorSessionByChatId, updateTutorProgress } = await import(
          '@/lib/actions/tutor'
        );

        const session = await getTutorSessionByChatId(ctx.chatId);
        if (!session) {
          return { success: false, error: 'No active tutor session found for this chat.' };
        }

        const state = await updateTutorProgress(session.id, action);
        if (!state) {
          return { success: false, error: 'Failed to update tutor progress.' };
        }

        return { success: true, ...state };
      } catch (error) {
        return {
          success: false,
          error: `Failed to update tutor progress: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });
}
