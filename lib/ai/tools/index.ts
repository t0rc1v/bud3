import type { Tool } from 'ai';
import type { ToolContext } from './types';
import { webSearchTool, youtubeSearchTool, researchMaterialsTool } from './web-search';
import { saveMemoryTool, fetchMemoryTool } from './memory';
import { serverActionsTool } from './server-actions';
import { getCurrentTimeTool } from './time';
import {
  createAssignmentTool,
  createQuizTool,
  createExamTool,
  createFlashcardsTool,
  createNotesDocumentTool,
} from './content-creation';
import {
  generateSummaryTool,
  generateOverviewTool,
  identifyKeywordsTool,
  generateStudyGuideTool,
} from './content-generation';
import {
  readResourceContentTool,
  searchResourceContentTool,
  webBrowseTool,
} from './resource-access';

// Phase 1: Grading
import { gradeSubmissionTool, reviewGradesTool } from './grading';
// Phase 2: Adaptive Learning
import { createStudyPlanTool, getStudyPlanTool, analyzeWeaknessesChatTool, getDueFlashcardsTool } from './study-plan';
// Phase 4: Curriculum Pipeline
import { importSyllabusTool, importPastPaperTool, importNotesTool } from './curriculum-pipeline';
// Phase 5: Teacher Copilot
import {
  queryStudentPerformanceTool,
  generateParentReportTool,
  queryTopicAnalyticsTool,
  generateLessonPlanTool,
  getClassRosterTool,
} from './teacher-copilot';
// Phase 6: Quality Check
import { checkSubmissionQualityTool } from './quality-check';
// Phase 7: Translation
import { translateContentTool } from './translate';
// Phase 8: Recommendations
import { getRecommendationsTool } from './recommendations';
// Phase 9: Retakes
import { createRetakeQuizTool } from './retake';
// Phase 11: Exam Prediction + Class Analytics
import { predictExamTopicsTool } from './exam-prediction';
import { queryClassAnalyticsTool } from './class-analytics';
import { wrapToolWithRetry } from './with-retry';
// Tutor state tracking
import { updateTutorProgressTool } from './tutor-state';

export type { ToolContext } from './types';

// Agent routing
import { buildDelegateToAgentTool } from '../agents/router';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = Tool<any, any>;

/**
 * Build the full tool set for a chat request, conditionally gated by role.
 *
 * - All users: base 19 tools + translate, recommendations, due flashcards
 * - Regular (learner): + study plan, tutor, retake, weakness analysis
 * - Admin (teacher): + grading, teacher copilot, curriculum pipeline, parent reports, class analytics, exam prediction, quality check
 * - Super admin: all tools
 */
export function buildToolSet(ctx: ToolContext) {
  const isAdmin = ctx.user.role === 'admin' || ctx.user.role === 'super_admin';
  const isSuperAdmin = ctx.user.role === 'super_admin';
  const isRegular = ctx.user.role === 'regular';

  // ── Base tools available to ALL users ──────────────────────────
  const tools: Record<string, AnyTool> = {
    web_search: webSearchTool(ctx),
    youtube_search: youtubeSearchTool(ctx),
    research_materials: researchMaterialsTool(ctx),
    save_memory: saveMemoryTool(ctx),
    fetch_memory: fetchMemoryTool(ctx),
    server_actions: serverActionsTool(ctx),
    web_browse: webBrowseTool(ctx),
    get_current_time: getCurrentTimeTool(ctx),
    create_assignment: createAssignmentTool(ctx),
    create_quiz: createQuizTool(ctx),
    create_flashcards: createFlashcardsTool(ctx),
    generate_summary: generateSummaryTool(ctx),
    generate_overview: generateOverviewTool(ctx),
    identify_keywords: identifyKeywordsTool(ctx),
    generate_study_guide: generateStudyGuideTool(ctx),
    create_notes_document: createNotesDocumentTool(ctx),
    create_exam: createExamTool(ctx),
    read_resource_content: readResourceContentTool(ctx),
    search_resource_content: searchResourceContentTool(ctx),

    // Phase 7: Available to all users
    translate_content: translateContentTool(ctx),

    // Phase 8: Available to all users
    get_recommendations: getRecommendationsTool(ctx),

    // Phase 2: Due flashcards available to all
    get_due_flashcards: getDueFlashcardsTool(ctx),
  };

  // ── Regular (learner) tools ───────────────────────────────────
  if (isRegular || isSuperAdmin) {
    tools.create_study_plan = createStudyPlanTool(ctx);
    tools.get_study_plan = getStudyPlanTool(ctx);
    tools.analyze_weaknesses = analyzeWeaknessesChatTool(ctx);
    tools.create_retake_quiz = createRetakeQuizTool(ctx);
    tools.update_tutor_progress = updateTutorProgressTool(ctx);
  }

  // ── Admin (teacher) tools ─────────────────────────────────────
  if (isAdmin) {
    // Phase 1: Grading
    tools.grade_submission = gradeSubmissionTool(ctx);
    tools.review_grades = reviewGradesTool(ctx);

    // Phase 4: Curriculum Pipeline
    tools.import_syllabus = importSyllabusTool(ctx);
    tools.import_past_paper = importPastPaperTool(ctx);
    tools.import_notes = importNotesTool(ctx);

    // Phase 5: Teacher Copilot
    tools.query_student_performance = queryStudentPerformanceTool(ctx);
    tools.generate_parent_report = generateParentReportTool(ctx);
    tools.query_topic_analytics = queryTopicAnalyticsTool(ctx);
    tools.generate_lesson_plan = generateLessonPlanTool(ctx);
    tools.get_class_roster = getClassRosterTool(ctx);

    // Phase 6: Quality Check
    tools.check_submission_quality = checkSubmissionQualityTool(ctx);

    // Phase 11: Exam Prediction + Class Analytics
    tools.predict_exam_topics = predictExamTopicsTool(ctx);
    tools.query_class_analytics = queryClassAnalyticsTool(ctx);
  }

  // ── Wrap safe-to-retry tools with automatic retry ───────────
  // Includes reads/queries (idempotent) AND creation tools (failed creates
  // produce no side effects, so retrying on transient errors is safe).
  const RETRYABLE_TOOLS = new Set([
    // Reads & queries
    'web_search', 'youtube_search', 'research_materials', 'web_browse',
    'read_resource_content', 'search_resource_content', 'fetch_memory',
    'get_current_time', 'get_recommendations', 'get_due_flashcards',
    'get_study_plan', 'analyze_weaknesses', 'translate_content',
    'query_student_performance', 'query_topic_analytics',
    'query_class_analytics', 'get_class_roster', 'review_grades',
    'predict_exam_topics',
    // Creation tools — a failed call created nothing, safe to retry
    'create_quiz', 'create_assignment', 'create_exam',
    'create_flashcards', 'create_notes_document', 'create_study_plan',
    'create_retake_quiz',
    // Generation tools — pure text generation, no side effects
    'generate_summary', 'generate_overview', 'identify_keywords',
    'generate_study_guide', 'generate_parent_report', 'generate_lesson_plan',
    // Grading & quality — analysis only, no DB writes on failure
    'grade_submission', 'check_submission_quality',
    // Curriculum import — failed imports don't persist partial data
    'import_syllabus', 'import_past_paper', 'import_notes',
  ]);

  for (const name of Object.keys(tools)) {
    if (RETRYABLE_TOOLS.has(name)) {
      tools[name] = wrapToolWithRetry(tools[name]);
    }
  }

  return tools;
}

/**
 * Build the full tool set with the delegate_to_agent router tool included.
 * Used when AGENT_ROUTING is enabled.
 */
export function buildToolSetWithRouter(ctx: ToolContext) {
  const tools = buildToolSet(ctx);
  tools.delegate_to_agent = buildDelegateToAgentTool(ctx.user.role);
  return tools;
}

/**
 * Group tool names by agent domain (matches registry.ts definitions).
 * Useful for understanding which tools belong to which agent.
 */
export function buildToolGroups(): Record<string, string[]> {
  return {
    always_available: [
      'save_memory',
      'fetch_memory',
      'get_current_time',
      'server_actions',
      'translate_content',
      'delegate_to_agent',
    ],
    researcher: ['web_search', 'youtube_search', 'research_materials', 'web_browse'],
    content_creator: [
      'create_quiz',
      'create_assignment',
      'create_exam',
      'create_flashcards',
      'create_notes_document',
    ],
    content_analyst: [
      'generate_summary',
      'generate_overview',
      'identify_keywords',
      'generate_study_guide',
      'read_resource_content',
      'search_resource_content',
    ],
    study_coach: [
      'create_study_plan',
      'get_study_plan',
      'analyze_weaknesses',
      'get_due_flashcards',
      'create_retake_quiz',
      'get_recommendations',
      'update_tutor_progress',
    ],
    teacher_assistant: [
      'grade_submission',
      'review_grades',
      'query_student_performance',
      'generate_parent_report',
      'query_topic_analytics',
      'generate_lesson_plan',
      'get_class_roster',
      'check_submission_quality',
      'predict_exam_topics',
      'query_class_analytics',
    ],
    curriculum_builder: ['import_syllabus', 'import_past_paper', 'import_notes'],
  };
}

/**
 * List of tool names that are "local" (do not require web access).
 * Used by prepareStep to skip expensive search tools for simple queries.
 */
export const LOCAL_TOOL_NAMES = [
  'save_memory',
  'fetch_memory',
  'get_current_time',
  'server_actions',
  'create_assignment',
  'create_quiz',
  'create_flashcards',
  'generate_summary',
  'generate_overview',
  'identify_keywords',
  'generate_study_guide',
  'create_notes_document',
  'create_exam',
  'read_resource_content',
  'search_resource_content',
  'translate_content',
  'get_recommendations',
  'get_due_flashcards',
  'create_study_plan',
  'get_study_plan',
  'analyze_weaknesses',
  'create_retake_quiz',
  'update_tutor_progress',
  'grade_submission',
  'review_grades',
  'import_syllabus',
  'import_past_paper',
  'import_notes',
  'query_student_performance',
  'generate_parent_report',
  'query_topic_analytics',
  'generate_lesson_plan',
  'get_class_roster',
  'check_submission_quality',
  'predict_exam_topics',
  'query_class_analytics',
] as const;
