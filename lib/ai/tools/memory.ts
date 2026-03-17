import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types';

export function saveMemoryTool(ctx: ToolContext) {
  return tool({
    description:
      'Save important information to memory for future reference. Save things like: student results, lesson plans, important notes, preferences, or any data the user might want to recall later. Always confirm what you\'re saving with the user. Use clear, descriptive titles and appropriate categories for easy retrieval.',
    inputSchema: z.object({
      title: z
        .string()
        .describe(
          'A clear, descriptive title for this memory (e.g., "John\'s Math Test Results", "Lesson Plan: Photosynthesis")'
        ),
      category: z
        .string()
        .describe(
          'Category for organization (e.g., "student_results", "lesson_plans", "notes", "preferences")'
        ),
      content: z
        .any()
        .describe(
          'The structured data to save (JSON object with relevant details)'
        ),
      description: z
        .string()
        .describe(
          'A brief description explaining what this memory contains and when to use it'
        ),
    }),
    execute: async ({ title, category, content, description }) => {
      try {
        const { saveMemoryItem } = await import('@/lib/actions/ai');
        await saveMemoryItem({
          userId: ctx.dbUserId,
          title,
          category,
          content,
          description,
        });
        return {
          success: true,
          message: `Memory "${title}" saved successfully in category "${category}"`,
        };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  });
}

export function fetchMemoryTool(ctx: ToolContext) {
  return tool({
    description:
      'Retrieve saved memories from the database. Use this when the user asks about previously saved information (e.g., "what did I save about...", "show my notes on...", "remember when I..."). Search by category or keywords to find relevant memories.',
    inputSchema: z.object({
      category: z
        .string()
        .optional()
        .describe(
          'Optional: Filter memories by category (e.g., "student_results", "lesson_plans", "notes")'
        ),
      searchTerm: z
        .string()
        .optional()
        .describe(
          'Optional: Search term to find memories by title or description'
        ),
      limit: z
        .number()
        .optional()
        .describe('Maximum number of memories to return (default: 10)'),
    }),
    execute: async ({ category, searchTerm, limit = 10 }) => {
      try {
        const { getMemoryItems, getMemoryItemsByCategory } = await import(
          '@/lib/actions/ai'
        );

        let memories;
        if (category) {
          memories = await getMemoryItemsByCategory(ctx.dbUserId, category);
        } else {
          memories = await getMemoryItems(ctx.dbUserId);
        }

        // Filter by search term if provided
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          memories = memories.filter(
            (m: { title: string; description: string | null; content: unknown }) =>
              m.title.toLowerCase().includes(searchLower) ||
              (m.description &&
                m.description.toLowerCase().includes(searchLower)) ||
              JSON.stringify(m.content).toLowerCase().includes(searchLower)
          );
        }

        // Apply limit
        memories = memories.slice(0, limit);

        return {
          success: true,
          memories: memories.map(
            (m: {
              id: string;
              title: string;
              category: string | null;
              description: string | null;
              content: unknown;
              createdAt: Date;
              updatedAt: Date;
            }) => ({
              id: m.id,
              title: m.title,
              category: m.category,
              description: m.description,
              content: m.content,
              createdAt: m.createdAt,
              updatedAt: m.updatedAt,
            })
          ),
          count: memories.length,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to fetch memories: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });
}
