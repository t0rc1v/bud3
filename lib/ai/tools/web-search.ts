import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types';
import {
  searchWeb,
  searchYouTube,
  researchMaterials,
  formatSearchResultsForAI,
} from '@/lib/ai/tools';

export function webSearchTool(_ctx: ToolContext) {
  return tool({
    description:
      'Search the web for current information on any topic. Returns web pages, articles, and documents relevant to the query.',
    inputSchema: z.object({
      query: z.string().describe('The search query'),
      numResults: z
        .number()
        .optional()
        .describe('Number of results to return (default: 10)'),
      category: z
        .enum([
          'company',
          'research paper',
          'news',
          'tweet',
          'personal site',
          'financial report',
          'people',
        ])
        .optional()
        .describe('Optional category to filter results'),
    }),
    execute: async ({ query, numResults = 10, category }) => {
      try {
        const results = await searchWeb(query, {
          numResults,
          type: 'auto',
          category,
        });
        return {
          results,
          formatted: formatSearchResultsForAI(results, 'web'),
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to search web: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });
}

export function youtubeSearchTool(_ctx: ToolContext) {
  return tool({
    description:
      'Search YouTube for educational videos. Returns video results with titles, URLs, descriptions, and thumbnails.',
    inputSchema: z.object({
      query: z
        .string()
        .describe('The search query for educational videos'),
      numResults: z
        .number()
        .optional()
        .describe('Number of results to return (default: 10)'),
    }),
    execute: async ({ query, numResults = 10 }) => {
      try {
        const results = await searchYouTube(query, {
          numResults,
          type: 'auto',
        });
        return {
          results,
          formatted: formatSearchResultsForAI(results, 'youtube'),
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to search YouTube: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });
}

export function researchMaterialsTool(_ctx: ToolContext) {
  return tool({
    description:
      'Research and find educational materials from multiple sources (web articles, YouTube videos, research papers). This is a comprehensive search that aggregates results from various sources for lesson planning or topic research.',
    inputSchema: z.object({
      query: z
        .string()
        .describe('The research query for finding educational materials'),
      numResults: z
        .number()
        .optional()
        .describe('Total number of results to return (default: 15)'),
      materialTypes: z
        .array(z.enum(['video', 'article', 'pdf']))
        .optional()
        .describe('Types of materials to search for (default: all types)'),
    }),
    execute: async ({
      query,
      numResults = 15,
      materialTypes = ['video', 'article', 'pdf'],
    }) => {
      try {
        const results = await researchMaterials(query, {
          numResults,
          materialTypes,
        });
        return {
          results,
          formatted: formatSearchResultsForAI(results, 'research'),
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to research materials: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });
}
