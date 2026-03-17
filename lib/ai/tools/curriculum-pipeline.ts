import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types';

export function importSyllabusTool(ctx: ToolContext) {
  return tool({
    description:
      'Import a syllabus document and extract curriculum structure (levels, subjects, topics). Requires admin approval before applying.',
    inputSchema: z.object({
      sourceResourceId: z.string().optional().describe('UUID of a platform resource containing the syllabus'),
      sourceUrl: z.string().optional().describe('URL to the syllabus document'),
      extractedContent: z.any().describe('The extracted/parsed syllabus content'),
      proposedStructure: z.any().describe('Proposed hierarchy: { levels: [{ title, levelNumber, subjects: [{ name, topics: [{ title }] }] }] }'),
    }),
    needsApproval: () => true,
    execute: async ({ sourceResourceId, sourceUrl, extractedContent, proposedStructure }) => {
      try {
        const { createCurriculumImport, updateCurriculumImport } = await import('@/lib/actions/curriculum-import');

        const record = await createCurriculumImport({
          userId: ctx.dbUserId,
          sourceType: 'syllabus',
          sourceResourceId,
          sourceUrl,
        });

        await updateCurriculumImport(record.id, {
          extractedContent,
          proposedStructure,
          status: 'review',
        });

        return {
          success: true,
          importId: record.id,
          status: 'review',
          message: 'Syllabus imported and ready for review. Use the curriculum import wizard to approve and apply.',
        };
      } catch (error) {
        return { success: false, error: `Failed to import syllabus: ${error instanceof Error ? error.message : String(error)}` };
      }
    },
  });
}

export function importPastPaperTool(ctx: ToolContext) {
  return tool({
    description: 'Import a past paper and extract question patterns, topics covered, and difficulty distribution.',
    inputSchema: z.object({
      sourceResourceId: z.string().optional(),
      sourceUrl: z.string().optional(),
      extractedContent: z.any().describe('Parsed past paper content'),
      proposedStructure: z.any().describe('Extracted patterns and topics'),
    }),
    execute: async ({ sourceResourceId, sourceUrl, extractedContent, proposedStructure }) => {
      try {
        const { createCurriculumImport, updateCurriculumImport } = await import('@/lib/actions/curriculum-import');

        const record = await createCurriculumImport({
          userId: ctx.dbUserId,
          sourceType: 'past_paper',
          sourceResourceId,
          sourceUrl,
        });

        await updateCurriculumImport(record.id, {
          extractedContent,
          proposedStructure,
          status: 'review',
        });

        return { success: true, importId: record.id, status: 'review' };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  });
}

export function importNotesTool(ctx: ToolContext) {
  return tool({
    description: 'Import notes document and chunk it into topic-level resources.',
    inputSchema: z.object({
      sourceResourceId: z.string().optional(),
      sourceUrl: z.string().optional(),
      extractedContent: z.any().describe('Parsed notes content'),
      proposedStructure: z.any().describe('Proposed chunking structure'),
    }),
    execute: async ({ sourceResourceId, sourceUrl, extractedContent, proposedStructure }) => {
      try {
        const { createCurriculumImport, updateCurriculumImport } = await import('@/lib/actions/curriculum-import');

        const record = await createCurriculumImport({
          userId: ctx.dbUserId,
          sourceType: 'notes',
          sourceResourceId,
          sourceUrl,
        });

        await updateCurriculumImport(record.id, {
          extractedContent,
          proposedStructure,
          status: 'review',
        });

        return { success: true, importId: record.id, status: 'review' };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  });
}
