import { AVAILABLE_MODELS, type CapabilityTier } from './models';

/**
 * Named credit cost constants for all AI operations.
 * Centralised here so changes propagate everywhere.
 */

/** Per-tier chat message costs */
export const CHAT_TIER_COSTS: Record<CapabilityTier, number> = {
  fast: 1,
  balanced: 1,
  powerful: 5,
  thinking: 1,
};

export const CREDIT_COSTS = {
  /** Standard chat message (non-powerful models) */
  CHAT: 1,
  /** Powerful-tier chat message */
  CHAT_POWERFUL: 5,
  /** Essay-type submission grading */
  ESSAY_GRADING: 2,
  /** MCQ-only submission grading */
  MCQ_GRADING: 1,
  /** Study plan generation */
  STUDY_PLAN: 3,
  /** Syllabus import via curriculum pipeline */
  SYLLABUS_IMPORT: 5,
  /** Past paper import */
  PAST_PAPER_IMPORT: 3,
  /** Notes chunking / import */
  NOTES_IMPORT: 3,
  /** Plagiarism / quality check */
  QUALITY_CHECK: 2,
  /** Content translation */
  TRANSLATION: 1,
  /** Parent report generation */
  PARENT_REPORT: 2,
  /** Exam prediction analysis */
  EXAM_PREDICTION: 1,
} as const;

export type CreditCostKey = keyof typeof CREDIT_COSTS;

/**
 * Returns the credit cost for a chat message given a model ID.
 * Powerful-tier models cost 5 credits; all others cost 1.
 */
export function getChatCreditCost(modelId?: string): number {
  if (!modelId) return CREDIT_COSTS.CHAT;

  const model = AVAILABLE_MODELS.find((m) => m.id === modelId);
  const tier = model?.tier ?? 'balanced';
  return CHAT_TIER_COSTS[tier];
}
