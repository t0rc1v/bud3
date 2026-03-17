import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types';

export function checkSubmissionQualityTool(_ctx: ToolContext) {
  return tool({
    description:
      'Run plagiarism detection and writing quality analysis on a student submission. Returns originality score and quality feedback.',
    inputSchema: z.object({
      submissionId: z.string().describe('The UUID of the submission to check'),
    }),
    execute: async ({ submissionId }) => {
      try {
        const { checkPlagiarism, checkWritingQuality } = await import(
          '@/lib/actions/quality-check'
        );

        const [plagiarismResult, qualityResult] = await Promise.all([
          checkPlagiarism(submissionId),
          checkWritingQuality(submissionId),
        ]);

        return {
          success: true,
          originalityScore: plagiarismResult.originalityScore,
          flagged: plagiarismResult.flagged,
          flagReason: plagiarismResult.flagReason,
          similarityResults: plagiarismResult.similarityResults,
          qualityFeedback: qualityResult,
        };
      } catch (error) {
        return {
          success: false,
          error: `Quality check failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });
}
