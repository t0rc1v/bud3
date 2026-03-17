"use server";

import { db } from "@/lib/db";
import { curriculumImport } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { logAudit } from "@/lib/audit";

export async function createCurriculumImport(params: {
  userId: string;
  sourceType: string;
  sourceResourceId?: string;
  sourceUrl?: string;
}) {
  const [record] = await db
    .insert(curriculumImport)
    .values({
      userId: params.userId,
      sourceType: params.sourceType,
      sourceResourceId: params.sourceResourceId,
      sourceUrl: params.sourceUrl,
      status: "uploading",
    })
    .returning();
  return record;
}

export async function updateCurriculumImport(
  importId: string,
  data: Partial<{
    extractedContent: unknown;
    proposedStructure: unknown;
    status: string;
    appliedEntities: unknown;
    errorMessage: string;
  }>
) {
  const [updated] = await db
    .update(curriculumImport)
    .set(data as Record<string, unknown>)
    .where(eq(curriculumImport.id, importId))
    .returning();
  return updated;
}

export async function getCurriculumImportById(importId: string) {
  const [record] = await db
    .select()
    .from(curriculumImport)
    .where(eq(curriculumImport.id, importId));
  return record || null;
}

export async function getCurriculumImports(userId: string) {
  return db
    .select()
    .from(curriculumImport)
    .where(and(eq(curriculumImport.userId, userId), eq(curriculumImport.isActive, true)))
    .orderBy(desc(curriculumImport.createdAt));
}

/**
 * Apply a proposed curriculum structure by creating levels/subjects/topics/resources.
 * This is called after the user approves the proposed structure.
 */
export async function applyCurriculumStructure(
  importId: string,
  actorId: string
) {
  const record = await getCurriculumImportById(importId);
  if (!record) throw new Error("Import not found");
  if (record.status !== "review") throw new Error("Import is not in review status");

  const proposed = record.proposedStructure as {
    levels?: Array<{
      title: string;
      levelNumber: number;
      subjects?: Array<{
        name: string;
        topics?: Array<{ title: string }>;
      }>;
    }>;
  };

  if (!proposed?.levels?.length) {
    throw new Error("No proposed structure to apply");
  }

  // Create the hierarchy using existing admin functions
  const { createLevel, createSubject, createTopic } = await import(
    "@/lib/actions/admin"
  );

  const appliedEntities: unknown[] = [];

  for (const lvl of proposed.levels) {
    try {
      const level = await createLevel({
        title: lvl.title,
        levelNumber: lvl.levelNumber,
        order: lvl.levelNumber,
        color: "#3B82F6",
        ownerId: actorId,
        ownerRole: "admin",
        visibility: "admin_and_regulars",
      });
      appliedEntities.push({ type: "level", id: level.id, title: lvl.title });

      if (lvl.subjects) {
        for (const subj of lvl.subjects) {
          const subject = await createSubject({
            levelId: level.id,
            name: subj.name,
            icon: "📚",
            color: "#10B981",
            ownerId: actorId,
            ownerRole: "admin",
            visibility: "admin_and_regulars",
          });
          appliedEntities.push({
            type: "subject",
            id: subject.id,
            name: subj.name,
          });

          if (subj.topics) {
            for (let i = 0; i < subj.topics.length; i++) {
              const t = subj.topics[i];
              const topic = await createTopic({
                subjectId: subject.id,
                title: t.title,
                order: i + 1,
                ownerId: actorId,
                ownerRole: "admin",
                visibility: "admin_and_regulars",
              });
              appliedEntities.push({
                type: "topic",
                id: topic.id,
                title: t.title,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error(`Failed to create level ${lvl.title}:`, error);
    }
  }

  await updateCurriculumImport(importId, {
    status: "applied",
    appliedEntities,
  });

  await logAudit(actorId, "curriculum.applied", "curriculum_import", importId, {
    entityCount: appliedEntities.length,
  });

  return appliedEntities;
}
