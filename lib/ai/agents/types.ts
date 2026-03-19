export type AgentId =
  | 'researcher'
  | 'content_creator'
  | 'content_analyst'
  | 'study_coach'
  | 'teacher_assistant'
  | 'curriculum_builder'
  | 'general';

export interface AgentDefinition {
  id: AgentId;
  name: string;
  /** Short description the router uses to decide which agent to delegate to */
  description: string;
  /** Tool names this agent has access to (in addition to always-available tools) */
  toolNames: string[];
  /** Relative path to the skill markdown file (from project root) */
  skillFile: string;
  /** Roles allowed to use this agent. undefined = all roles */
  requiredRoles?: string[];
}

/** Tools available in every step (router + specialist) */
export const ALWAYS_AVAILABLE_TOOLS = [
  'save_memory',
  'fetch_memory',
  'get_current_time',
  'server_actions',
  'translate_content',
  'delegate_to_agent',
] as const;
