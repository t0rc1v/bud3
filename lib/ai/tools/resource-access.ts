import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types';

export function readResourceContentTool(ctx: ToolContext) {
  return tool({
    description:
      'Read the full text content of a platform resource by its ID. Extracts text from PDFs server-side via pdf-parse. Supports pagination for large documents. Use when the user asks you to summarize, analyze, or work with a specific resource.',
    inputSchema: z.object({
      resourceId: z.string().describe('The UUID of the resource to read'),
      maxCharacters: z
        .number()
        .optional()
        .describe('Maximum characters to return (default: 50000)'),
      startOffset: z
        .number()
        .optional()
        .describe('Character offset to start from, for pagination (default: 0)'),
    }),
    execute: async ({ resourceId, maxCharacters = 50000, startOffset = 0 }) => {
      try {
        const UUID_RE =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!UUID_RE.test(resourceId)) {
          return { success: false, error: 'Invalid resourceId format' };
        }

        // Visibility check: ensure user can access this resource
        const { getResourcesForUser } = await import('@/lib/actions/admin');
        const accessible = await getResourcesForUser(
          ctx.dbUserId,
          ctx.user.role as 'regular' | 'admin' | 'super_admin'
        );
        const found = accessible.find(
          (r: { id: string }) => r.id === resourceId
        );
        if (!found) {
          return {
            success: false,
            error: 'Resource not found or not accessible',
          };
        }

        // Get topic & subject info
        const { getResourceById } = await import('@/lib/actions/admin');
        const fullResource = await getResourceById(resourceId);

        const { extractResourceText } = await import('@/lib/ai/extract-text');
        const extraction = await extractResourceText(resourceId);

        const slice = extraction.text.slice(
          startOffset,
          startOffset + maxCharacters
        );
        const hasMore =
          startOffset + maxCharacters < extraction.charCount;

        return {
          success: true,
          title: found.title,
          type: found.type,
          topic: fullResource?.topic?.title || null,
          subject: fullResource?.subject?.name || null,
          totalCharacters: extraction.charCount,
          hasMore,
          nextOffset: hasMore ? startOffset + maxCharacters : null,
          extractedFrom: extraction.extractedFrom,
          text: slice,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to read resource: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });
}

export function searchResourceContentTool(ctx: ToolContext) {
  return tool({
    description:
      'Search across all platform resources accessible to the current user. Uses full-text search over titles, descriptions, and extracted PDF text. Returns matching resources with excerpts. After searching, use read_resource_content to get full content of specific results.',
    inputSchema: z.object({
      query: z.string().describe('Search query'),
      topicId: z
        .string()
        .optional()
        .describe('Optional topic UUID to filter by'),
      subjectId: z
        .string()
        .optional()
        .describe('Optional subject UUID to filter by'),
      resourceType: z
        .enum(['notes', 'video', 'audio', 'image'])
        .optional()
        .describe('Optional resource type filter'),
      limit: z
        .number()
        .optional()
        .describe('Max results to return (default: 10, max: 20)'),
    }),
    execute: async ({ query, topicId, subjectId, resourceType, limit = 10 }) => {
      try {
        const sanitized = query.replace(/[^\w\s]/g, ' ').trim();
        if (!sanitized) {
          return { success: false, error: 'Empty search query' };
        }

        const effectiveLimit = Math.min(Math.max(limit, 1), 20);

        const {
          resource: resourceTable,
          topic: topicTable,
          subject: subjectTable,
        } = await import('@/lib/db/schema');
        const {
          sql: sqlTag,
          eq: eqOp,
          and: andOp,
        } = await import('drizzle-orm');
        const { db: dbInst } = await import('@/lib/db');

        const tsvectorExpr = sqlTag`to_tsvector('english', coalesce(${resourceTable.title}, '') || ' ' || coalesce(${resourceTable.description}, '') || ' ' || coalesce(${resourceTable.metadata}->>'extractedText', ''))`;
        const tsqueryExpr = sqlTag`websearch_to_tsquery('english', ${sanitized})`;

        const isAdmin =
          ctx.user.role === 'admin' || ctx.user.role === 'super_admin';

        const conditions = [
          sqlTag`${tsvectorExpr} @@ ${tsqueryExpr}`,
          eqOp(resourceTable.isActive, true),
        ];

        if (!isAdmin) {
          conditions.push(eqOp(resourceTable.status, 'published'));
          conditions.push(
            sqlTag`${resourceTable.visibility} IN ('public', 'admin_and_regulars', 'regular_only')`
          );
        }

        if (topicId) {
          const UUID_RE =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (UUID_RE.test(topicId)) {
            conditions.push(eqOp(resourceTable.topicId, topicId));
          }
        }
        if (subjectId) {
          const UUID_RE =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (UUID_RE.test(subjectId)) {
            conditions.push(eqOp(resourceTable.subjectId, subjectId));
          }
        }
        if (resourceType) {
          conditions.push(eqOp(resourceTable.type, resourceType));
        }

        const results = await dbInst
          .select({
            id: resourceTable.id,
            title: resourceTable.title,
            description: resourceTable.description,
            type: resourceTable.type,
            topicTitle: topicTable.title,
            subjectName: subjectTable.name,
            rank: sqlTag<number>`ts_rank(${tsvectorExpr}, ${tsqueryExpr})`,
            excerpt: sqlTag<string>`left(coalesce(${resourceTable.metadata}->>'extractedText', ${resourceTable.description}), 500)`,
          })
          .from(resourceTable)
          .leftJoin(topicTable, eqOp(resourceTable.topicId, topicTable.id))
          .leftJoin(
            subjectTable,
            eqOp(resourceTable.subjectId, subjectTable.id)
          )
          .where(andOp(...conditions))
          .orderBy(sqlTag`rank DESC`)
          .limit(effectiveLimit);

        return {
          success: true,
          results: results.map((r) => ({
            id: r.id,
            title: r.title,
            type: r.type,
            topic: r.topicTitle,
            subject: r.subjectName,
            rank: r.rank,
            excerpt: r.excerpt,
          })),
          count: results.length,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to search resources: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });
}

export function webBrowseTool(_ctx: ToolContext) {
  return tool({
    description:
      'Browse a URL to extract its content. Use this ONLY when the user provides a specific URL and asks you to read, summarize, or analyze its content. Works with web pages, PDFs, and documents hosted on the web.',
    inputSchema: z.object({
      url: z
        .string()
        .describe('The URL to browse and extract content from'),
      maxCharacters: z
        .number()
        .optional()
        .describe('Maximum characters to return (default: 10000)'),
    }),
    execute: async ({ url, maxCharacters = 10000 }) => {
      try {
        const { browseUrl } = await import('@/lib/ai/web-browse');
        const result = await browseUrl(url, { maxCharacters });

        if (result.status === 'error') {
          return {
            success: false,
            error: result.error || 'Failed to browse URL',
          };
        }

        return {
          success: true,
          title: result.title,
          url: result.url,
          content: result.content,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to browse URL: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });
}
