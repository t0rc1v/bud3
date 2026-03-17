import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types';

export function gradeSubmissionTool(ctx: ToolContext) {
  return tool({
    description:
      'Grade a student submission (MCQ = exact match, essay = rubric-based). Automatically creates a grade record linked to the submission.',
    inputSchema: z.object({
      submissionId: z.string().describe('The UUID of the submission to grade'),
    }),
    execute: async ({ submissionId }) => {
      try {
        const { gradeSubmissionWithAI } = await import(
          '@/lib/actions/grading'
        );
        const grade = await gradeSubmissionWithAI(submissionId);
        return {
          success: true,
          gradeId: grade.id,
          totalScore: grade.totalScore,
          maxScore: grade.maxScore,
          percentage: grade.percentage,
          passed: grade.passed,
          feedback: grade.overallFeedback,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to grade submission: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });
}

export function reviewGradesTool(ctx: ToolContext) {
  return tool({
    description:
      'View grades for a specific assessment (exam or assignment). Returns all submissions with their grades for teacher review.',
    inputSchema: z.object({
      assessmentId: z
        .string()
        .describe('The UUID of the exam or assignment'),
      type: z
        .enum(['exam', 'assignment'])
        .describe('Type of assessment'),
    }),
    execute: async ({ assessmentId, type }) => {
      try {
        const { getSubmissionsByAssessment } = await import(
          '@/lib/actions/grading'
        );
        const { getGrade } = await import('@/lib/actions/grading');

        const submissions = await getSubmissionsByAssessment(
          assessmentId,
          type
        );

        const results = await Promise.all(
          submissions.map(async (s) => {
            const grade = await getGrade(s.id);
            return {
              submissionId: s.id,
              userId: s.userId,
              status: s.status,
              submittedAt: s.submittedAt,
              grade: grade
                ? {
                    gradeId: grade.id,
                    totalScore: grade.totalScore,
                    maxScore: grade.maxScore,
                    percentage: grade.percentage,
                    passed: grade.passed,
                    gradedBy: grade.gradedBy,
                    status: grade.status,
                  }
                : null,
            };
          })
        );

        return {
          success: true,
          assessmentId,
          type,
          submissionCount: results.length,
          results,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to review grades: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });
}
