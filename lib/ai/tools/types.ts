/**
 * Shared context passed to every tool factory.
 * Extended in later phases (tutorSessionId, language, etc.).
 */
export interface ToolContext {
  dbUserId: string;
  clerkId: string;
  user: { id: string; role: string; email: string };
  chatId?: string;
  language?: string;        // Phase 7
  tutorSessionId?: string;  // Phase 3
}
