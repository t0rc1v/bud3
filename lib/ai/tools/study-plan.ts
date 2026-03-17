import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types';

export function createStudyPlanTool(ctx: ToolContext) {
  return tool({
    description:
      'Create a personalized study plan for the student. Includes daily/weekly schedule, goals, and recommended activities.',
    inputSchema: z.object({
      title: z.string().describe('Study plan title'),
      subject: z.string().describe('Subject area'),
      level: z.string().optional().describe('Academic level'),
      goals: z.any().optional().describe('Learning goals (JSON)'),
      schedule: z.any().optional().describe('Daily/weekly schedule (JSON)'),
      weeklyHoursTarget: z.number().optional().describe('Target study hours per week'),
      startDate: z.string().optional().describe('Start date (ISO string)'),
      endDate: z.string().optional().describe('End date (ISO string)'),
    }),
    execute: async ({ title, subject, level, goals, schedule, weeklyHoursTarget, startDate, endDate }) => {
      try {
        const { createStudyPlan } = await import('@/lib/actions/study-plans');
        const plan = await createStudyPlan({
          userId: ctx.dbUserId,
          title,
          subject,
          level,
          goals,
          schedule,
          weeklyHoursTarget,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
        });
        return { success: true, planId: plan.id, title: plan.title };
      } catch (error) {
        return { success: false, error: `Failed to create study plan: ${error instanceof Error ? error.message : String(error)}` };
      }
    },
  });
}

export function getStudyPlanTool(ctx: ToolContext) {
  return tool({
    description: 'Get the active study plan for the current student.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const { getActiveStudyPlan } = await import('@/lib/actions/study-plans');
        const plan = await getActiveStudyPlan(ctx.dbUserId);
        if (!plan) return { success: true, plan: null, message: 'No active study plan found.' };
        return { success: true, plan };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  });
}

export function analyzeWeaknessesChatTool(ctx: ToolContext) {
  return tool({
    description: 'Analyze the student\'s weak topics based on quiz performance and grades. Returns a weakness profile with scores per subject.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const { analyzeWeaknesses } = await import('@/lib/actions/weakness-analysis');
        const profile = await analyzeWeaknesses(ctx.dbUserId);
        return {
          success: true,
          weaknesses: profile.map((w) => ({
            subject: w.subject,
            weaknessScore: w.weaknessScore,
            evidence: w.evidenceData,
          })),
        };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  });
}

export function getDueFlashcardsTool(ctx: ToolContext) {
  return tool({
    description: 'Get flashcards that are due for review (spaced repetition). Returns card IDs that need reviewing.',
    inputSchema: z.object({
      flashcardSetId: z.string().optional().describe('Optional: filter by specific flashcard set'),
    }),
    execute: async ({ flashcardSetId }) => {
      try {
        const { getDueFlashcards } = await import('@/lib/actions/spaced-repetition');
        const due = await getDueFlashcards(ctx.dbUserId, flashcardSetId);
        return {
          success: true,
          dueCount: due.length,
          cards: due.map((d) => ({
            cardId: d.cardId,
            flashcardSetId: d.flashcardSetId,
            lastRating: d.rating,
            reviewCount: d.reviewCount,
            nextReviewDate: d.nextReviewDate,
          })),
        };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  });
}
