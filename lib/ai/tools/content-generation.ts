import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types';

export function generateSummaryTool(_ctx: ToolContext) {
  return tool({
    description:
      'Generate a comprehensive summary that captures the full context and key details of provided content. Use this when the user asks for summaries, recaps, or wants to condense information while preserving important context.',
    inputSchema: z.object({
      content: z.string().describe('The content to summarize'),
      context: z.string().optional().describe('Additional context about the content'),
      format: z
        .enum(['brief', 'detailed', 'comprehensive'])
        .describe('Summary detail level'),
      focusAreas: z
        .array(z.string())
        .optional()
        .describe('Specific areas or themes to emphasize'),
    }),
    execute: async ({ content, context, format = 'comprehensive', focusAreas }) => {
      try {
        return {
          success: true,
          format: 'summary',
          content,
          context: context || null,
          detailLevel: format,
          focusAreas: focusAreas || [],
          generatedAt: new Date().toISOString(),
          metadata: { contentLength: content.length, hasContext: !!context, format },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to generate summary: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });
}

export function generateOverviewTool(_ctx: ToolContext) {
  return tool({
    description:
      'Generate a comprehensive overview of a topic or subject. Creates structured content with introduction, main sections, and conclusion.',
    inputSchema: z.object({
      topic: z.string().describe('The main topic or subject to overview'),
      subject: z.string().describe('Subject area'),
      level: z.string().optional().describe('Target level'),
      depth: z
        .enum(['basic', 'intermediate', 'advanced'])
        .describe('Depth of coverage'),
      sections: z
        .array(z.string())
        .optional()
        .describe('Specific sections to include'),
    }),
    execute: async ({ topic, subject, level, depth = 'intermediate', sections }) => {
      try {
        return {
          success: true,
          format: 'overview',
          topic,
          subject,
          level: level || 'General',
          depth,
          sections: sections || [],
          generatedAt: new Date().toISOString(),
          metadata: {
            topic,
            subject,
            level: level || 'General',
            depth,
            customSections: (sections || []).length > 0,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to generate overview: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });
}

export function identifyKeywordsTool(_ctx: ToolContext) {
  return tool({
    description:
      'Identify and extract key terms, concepts, and vocabulary from content. Each keyword includes the term itself, a clear definition, and multiple examples.',
    inputSchema: z.object({
      content: z.string().describe('The content to analyze for keywords'),
      maxKeywords: z.number().optional().describe('Max keywords (default: 20)'),
      includeDefinitions: z.boolean().optional().describe('Include definitions (default: true)'),
      includeExamples: z.boolean().optional().describe('Include examples (default: true)'),
      category: z.string().optional().describe('Category or domain for context'),
    }),
    execute: async ({
      content,
      maxKeywords = 20,
      includeDefinitions = true,
      includeExamples = true,
      category,
    }) => {
      try {
        return {
          success: true,
          format: 'keywords',
          content,
          category: category || 'General',
          settings: { maxKeywords, includeDefinitions, includeExamples },
          generatedAt: new Date().toISOString(),
          metadata: { contentLength: content.length, maxKeywords, hasCategory: !!category },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to identify keywords: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });
}

export function generateStudyGuideTool(_ctx: ToolContext) {
  return tool({
    description:
      'Generate a comprehensive study guide with multiple structured sections for effective learning. Includes overview, key concepts, important terms, practice problems, and review materials.',
    inputSchema: z.object({
      topic: z.string().describe('The main topic for the study guide'),
      subject: z.string().describe('Subject area'),
      level: z.string().optional().describe('Target academic level'),
      sections: z
        .array(
          z.enum([
            'overview',
            'key_concepts',
            'important_terms',
            'core_principles',
            'practical_applications',
            'common_misconceptions',
            'practice_problems',
            'quick_review',
            'further_reading',
          ])
        )
        .optional()
        .describe('Specific sections to include'),
      focusAreas: z
        .array(z.string())
        .optional()
        .describe('Specific topics to emphasize'),
    }),
    execute: async ({ topic, subject, level, sections, focusAreas }) => {
      try {
        const defaultSections = [
          'overview',
          'key_concepts',
          'important_terms',
          'core_principles',
          'practical_applications',
          'common_misconceptions',
          'practice_problems',
          'quick_review',
          'further_reading',
        ];

        return {
          success: true,
          format: 'study_guide',
          topic,
          subject,
          level: level || 'General',
          sections: sections || defaultSections,
          focusAreas: focusAreas || [],
          generatedAt: new Date().toISOString(),
          metadata: {
            topic,
            subject,
            level: level || 'General',
            sectionCount: (sections || defaultSections).length,
            hasFocusAreas: !!(focusAreas && focusAreas.length > 0),
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to generate study guide: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });
}
