import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types';

export function createRetakeQuizTool(ctx: ToolContext) {
  return tool({
    description:
      'Generate a retake quiz that emphasizes areas where the student previously scored poorly. Fetches the original quiz and past attempts, then creates a NEW quiz targeting weak areas.',
    inputSchema: z.object({
      originalQuizId: z.string().describe('The UUID of the original quiz to create a retake for'),
    }),
    execute: async ({ originalQuizId }) => {
      try {
        const { getAIQuizById, getQuizAttemptsByQuiz } = await import(
          '@/lib/actions/ai'
        );

        const originalQuiz = await getAIQuizById(originalQuizId);
        if (!originalQuiz) {
          return { success: false, error: 'Original quiz not found' };
        }

        const userAttempts = await getQuizAttemptsByQuiz(originalQuizId, ctx.dbUserId);

        // Analyze wrong answers across attempts
        const wrongQuestionIds = new Set<string>();
        for (const attempt of userAttempts) {
          const answers = attempt.answers as Array<{
            questionId: string;
            correct: boolean;
          }>;
          for (const a of answers) {
            if (!a.correct) wrongQuestionIds.add(a.questionId);
          }
        }

        return {
          success: true,
          format: 'retake_data',
          originalQuiz: {
            id: originalQuiz.id,
            title: originalQuiz.title,
            subject: originalQuiz.subject,
            questions: originalQuiz.questions,
          },
          weakAreas: Array.from(wrongQuestionIds),
          attemptCount: userAttempts.length,
          message:
            'Generate a new quiz focusing on these weak areas. The AI should create new questions on the same topics but with different wording.',
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to prepare retake: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });
}
