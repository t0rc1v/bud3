import type { AgentId, AgentDefinition } from './types';

const AGENTS: Record<AgentId, AgentDefinition> = {
  researcher: {
    id: 'researcher',
    name: 'Researcher',
    description:
      'Web search, YouTube search, research materials, and web browsing. Use for finding information, current events, articles, videos, and educational resources online.',
    toolNames: ['web_search', 'youtube_search', 'research_materials', 'web_browse'],
    skillFile: 'lib/ai/skills/researcher.md',
  },

  content_creator: {
    id: 'content_creator',
    name: 'Content Creator',
    description:
      'Creating quizzes, assignments, exams, flashcards, and notes documents. Use when the user wants to generate educational content or assessments.',
    toolNames: [
      'create_quiz',
      'create_assignment',
      'create_exam',
      'create_flashcards',
      'create_notes_document',
    ],
    skillFile: 'lib/ai/skills/content-creation.md',
  },

  content_analyst: {
    id: 'content_analyst',
    name: 'Content Analyst',
    description:
      'Summarizing, generating overviews, identifying keywords, creating study guides, and reading/searching platform resources. Use when the user wants to analyze or understand existing content.',
    toolNames: [
      'generate_summary',
      'generate_overview',
      'identify_keywords',
      'generate_study_guide',
      'read_resource_content',
      'search_resource_content',
    ],
    skillFile: 'lib/ai/skills/content-analysis.md',
  },

  study_coach: {
    id: 'study_coach',
    name: 'Study Coach',
    description:
      'Study plans, weakness analysis, spaced repetition flashcard review, retake quizzes, and learning recommendations. Use when the user wants personalized study guidance or to review their learning progress.',
    toolNames: [
      'create_study_plan',
      'get_study_plan',
      'analyze_weaknesses',
      'get_due_flashcards',
      'create_retake_quiz',
      'get_recommendations',
    ],
    skillFile: 'lib/ai/skills/study-coach.md',
    requiredRoles: ['regular', 'super_admin'],
  },

  teacher_assistant: {
    id: 'teacher_assistant',
    name: 'Teacher Assistant',
    description:
      'Grading submissions, reviewing grades, querying student performance, generating parent reports, topic analytics, lesson plans, class rosters, submission quality checks, exam predictions, and class analytics. Use for teaching and administrative tasks.',
    toolNames: [
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
    skillFile: 'lib/ai/skills/teacher-assistant.md',
    requiredRoles: ['admin', 'super_admin'],
  },

  curriculum_builder: {
    id: 'curriculum_builder',
    name: 'Curriculum Builder',
    description:
      'Importing syllabi, past papers, and notes into the platform. Use when the user wants to upload or import curriculum materials.',
    toolNames: ['import_syllabus', 'import_past_paper', 'import_notes'],
    skillFile: 'lib/ai/skills/curriculum-builder.md',
    requiredRoles: ['admin', 'super_admin'],
  },

  general: {
    id: 'general',
    name: 'General',
    description:
      'Fallback agent with access to all tools. Used for multi-domain requests or when no specialist agent fits.',
    toolNames: [], // Special case: loads ALL tools
    skillFile: '',
  },
};

/** Get a single agent definition by ID */
export function getAgent(id: AgentId): AgentDefinition | undefined {
  return AGENTS[id];
}

/** Get all agent definitions accessible to a given role */
export function getAgentsForRole(role: string): AgentDefinition[] {
  return Object.values(AGENTS).filter((agent) => {
    if (agent.id === 'general') return false; // Not exposed to router
    if (!agent.requiredRoles) return true;
    return agent.requiredRoles.includes(role);
  });
}

/** Get all agent definitions (including general) */
export function getAllAgents(): AgentDefinition[] {
  return Object.values(AGENTS);
}
