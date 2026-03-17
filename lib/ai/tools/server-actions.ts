import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types';

export function serverActionsTool(ctx: ToolContext) {
  return tool({
    description:
      "Call exposed server-side functions to perform system operations. Available actions include: get_levels (list all levels), add_regular (add a regular user to admin's list), get_my_regulars (list admin's regular users), create_resource (create educational resources), get_resources (list resources), get_topic_resources_content (get batch text content for all resources in a topic). Use this when the user requests operations that require backend data manipulation.",
    inputSchema: z.object({
      action: z.enum([
        'get_levels',
        'add_regular',
        'get_my_regulars',
        'create_resource',
        'get_resources',
        'get_subjects',
        'get_topics',
        'get_topic_resources_content',
      ]),
      params: z.any().optional(),
    }),
    // Mutation actions require explicit user confirmation before executing.
    needsApproval: (input) => {
      const mutations = ['add_regular', 'create_resource'];
      return mutations.includes(input.action);
    },
    execute: async ({ action, params = {} }) => {
      try {
        switch (action) {
          case 'get_levels': {
            const { getLevels } = await import('@/lib/actions/admin');
            const levels = await getLevels();
            return {
              success: true,
              action: 'get_levels',
              data: levels.map(
                (level: { id: string; title: string; levelNumber: number; subjects?: { name: string; id: string }[] }) => ({
                  id: level.id,
                  title: level.title,
                  levelNumber: level.levelNumber,
                  subjects:
                    level.subjects?.map(
                      (s: { name: string; id: string }) => s.name
                    ) || [],
                })
              ),
            };
          }

          case 'add_regular': {
            const { addMyLearner } = await import('@/lib/actions/admin');
            const { email, metadata } = params;
            if (!email) {
              return {
                success: false,
                error: 'Missing required parameter: email is required',
              };
            }
            await addMyLearner(
              ctx.clerkId,
              email as string,
              metadata as Record<string, unknown>
            );
            return {
              success: true,
              action: 'add_regular',
              message: `Regular user with email ${email} added successfully`,
            };
          }

          case 'get_my_regulars': {
            const { getMyLearners } = await import('@/lib/actions/admin');
            const regulars = await getMyLearners(ctx.clerkId);
            return {
              success: true,
              action: 'get_my_regulars',
              data: regulars.map(
                (l) => ({
                  id: l.id,
                  regularId: l.regularId,
                  email: l.regularEmail,
                  name: l.regular?.name,
                  level: l.regular?.level,
                  metadata: l.metadata,
                })
              ),
            };
          }

          case 'create_resource': {
            const { createResource } = await import('@/lib/actions/admin');
            const {
              subjectId,
              topicId,
              title,
              description,
              type,
              url,
              thumbnailUrl,
              metadata,
            } = params;
            if (
              !subjectId ||
              !topicId ||
              !title ||
              !description ||
              !type ||
              !url
            ) {
              return {
                success: false,
                error:
                  'Missing required parameters: subjectId, topicId, title, description, type, and url are required',
              };
            }
            await createResource({
              subjectId: subjectId as string,
              topicId: topicId as string,
              title: title as string,
              description: description as string,
              type: type as 'notes' | 'video' | 'audio' | 'image',
              url: url as string,
              thumbnailUrl: thumbnailUrl as string | undefined,
              metadata: metadata as Record<string, unknown> | undefined,
              ownerId: ctx.user.id,
              ownerRole: ctx.user.role as 'regular' | 'admin' | 'super_admin',
              visibility: 'admin_and_regulars',
            });
            return {
              success: true,
              action: 'create_resource',
              message: `Resource "${title}" created successfully`,
            };
          }

          case 'get_resources': {
            const { getResources } = await import('@/lib/actions/admin');
            const resources = await getResources();
            return {
              success: true,
              action: 'get_resources',
              data: resources.map(
                (r: {
                  id: string;
                  title: string;
                  description: string;
                  type: string;
                  url: string;
                  subject?: { name: string } | null;
                  topic?: { title: string } | null;
                }) => ({
                  id: r.id,
                  title: r.title,
                  description: r.description,
                  type: r.type,
                  subject: r.subject?.name,
                  topic: r.topic?.title,
                  url: r.url,
                })
              ),
            };
          }

          case 'get_subjects': {
            const { getSubjects } = await import('@/lib/actions/admin');
            const subjects = await getSubjects();
            return {
              success: true,
              action: 'get_subjects',
              data: subjects.map(
                (s: {
                  id: string;
                  name: string;
                  level?: { title: string } | null;
                  topics?: unknown[];
                }) => ({
                  id: s.id,
                  name: s.name,
                  level: s.level?.title,
                  topicCount: s.topics?.length || 0,
                })
              ),
            };
          }

          case 'get_topics': {
            const { getTopics } = await import('@/lib/actions/admin');
            const topics = await getTopics();
            return {
              success: true,
              action: 'get_topics',
              data: topics.map(
                (t: {
                  id: string;
                  title: string;
                  subject?: { name: string } | null;
                  resources?: unknown[];
                }) => ({
                  id: t.id,
                  title: t.title,
                  subject: t.subject?.name,
                  resourceCount: t.resources?.length || 0,
                })
              ),
            };
          }

          case 'get_topic_resources_content': {
            const { topicId: tId } = params;
            if (!tId) {
              return {
                success: false,
                error: 'Missing required parameter: topicId',
              };
            }
            const UUID_RE =
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!UUID_RE.test(tId as string)) {
              return { success: false, error: 'Invalid topicId format' };
            }
            const { resource: resourceTable } = await import(
              '@/lib/db/schema'
            );
            const { eq: eqOp } = await import('drizzle-orm');
            const { db: dbInst } = await import('@/lib/db');
            const topicResources = await dbInst
              .select({ id: resourceTable.id })
              .from(resourceTable)
              .where(eqOp(resourceTable.topicId, tId as string));
            if (topicResources.length === 0) {
              return {
                success: true,
                action: 'get_topic_resources_content',
                data: {
                  context: 'No resources found for this topic.',
                  totalResources: 0,
                  includedFull: [],
                  includedSummaryOnly: [],
                },
              };
            }
            const { buildBatchResourceContext } = await import(
              '@/lib/ai/resource-context'
            );
            const batchResult = await buildBatchResourceContext(
              topicResources.map((r) => r.id)
            );
            return {
              success: true,
              action: 'get_topic_resources_content',
              data: {
                context: batchResult.context,
                totalResources: batchResult.totalResources,
                includedFull: batchResult.includedFull.length,
                includedSummaryOnly: batchResult.includedSummaryOnly.length,
              },
            };
          }

          default:
            return { success: false, error: `Unknown action: ${action}` };
        }
      } catch (error) {
        return {
          success: false,
          action,
          error: `Failed to execute ${action}: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });
}
