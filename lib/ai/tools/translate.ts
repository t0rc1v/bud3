import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types';

export function translateContentTool(_ctx: ToolContext) {
  return tool({
    description:
      'Translate educational content between languages. The AI will produce the translation in its response.',
    inputSchema: z.object({
      text: z.string().describe('The text to translate'),
      fromLanguage: z.string().describe('Source language code (e.g., "en", "sw", "fr")'),
      toLanguage: z.string().describe('Target language code (e.g., "sw", "en", "fr")'),
      context: z.string().optional().describe('Context about the content (e.g., "biology textbook", "math problem")'),
    }),
    execute: async ({ text, fromLanguage, toLanguage, context }) => {
      return {
        success: true,
        format: 'translation',
        sourceText: text,
        fromLanguage,
        toLanguage,
        context: context || null,
        generatedAt: new Date().toISOString(),
      };
    },
  });
}
