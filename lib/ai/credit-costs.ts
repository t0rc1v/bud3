/**
 * Named credit cost constants for all AI operations.
 * Centralised here so changes propagate everywhere.
 */

export const CREDIT_COSTS = {
  /** Standard chat message */
  CHAT: 1,
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
