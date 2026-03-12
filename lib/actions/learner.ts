"use server";

import { db } from "@/lib/db";
import {
  resourceProgress,
  resourceBookmark,
  resourceNote,
  resourceRating,
  resource,
  topic,
  subject,
  level,
} from "@/lib/db/schema";
import { eq, and, desc, sql, count, inArray } from "drizzle-orm";

// ============== PROGRESS ==============

export type ProgressStatus = "not_started" | "started" | "completed";

export async function getResourceProgress(userId: string, resourceId: string) {
  const row = await db
    .select()
    .from(resourceProgress)
    .where(and(eq(resourceProgress.userId, userId), eq(resourceProgress.resourceId, resourceId)))
    .limit(1)
    .then((r) => r[0] ?? null);
  return row;
}

/**
 * Upsert progress for a resource. Status never regresses:
 * completed → started is silently ignored server-side.
 */
export async function upsertResourceProgress(
  userId: string,
  resourceId: string,
  status: "started" | "completed"
) {
  const now = new Date();

  const existing = await getResourceProgress(userId, resourceId);

  if (existing) {
    // Never regress from completed
    if (existing.status === "completed") {
      // Still update lastAccessedAt on re-open
      await db
        .update(resourceProgress)
        .set({ lastAccessedAt: now })
        .where(eq(resourceProgress.id, existing.id));
      return existing;
    }

    const updates: Record<string, unknown> = {
      status,
      lastAccessedAt: now,
    };
    if (status === "started" && !existing.startedAt) updates.startedAt = now;
    if (status === "completed") {
      if (!existing.startedAt) updates.startedAt = now;
      updates.completedAt = now;
    }

    const [updated] = await db
      .update(resourceProgress)
      .set(updates)
      .where(eq(resourceProgress.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(resourceProgress)
    .values({
      userId,
      resourceId,
      status,
      startedAt: status === "started" || status === "completed" ? now : undefined,
      completedAt: status === "completed" ? now : undefined,
      lastAccessedAt: now,
    })
    .returning();
  return created;
}

export async function getTopicProgressStats(userId: string, topicId: string) {
  const rows = await db
    .select({
      status: resourceProgress.status,
      cnt: count(),
    })
    .from(resourceProgress)
    .innerJoin(resource, eq(resourceProgress.resourceId, resource.id))
    .where(and(eq(resourceProgress.userId, userId), eq(resource.topicId, topicId)))
    .groupBy(resourceProgress.status);

  const map: Record<string, number> = {};
  for (const r of rows) map[r.status] = r.cnt;

  // Also get total resource count for the topic (including not-started ones)
  const [totalRow] = await db
    .select({ total: count() })
    .from(resource)
    .where(eq(resource.topicId, topicId));

  return {
    total: totalRow?.total ?? 0,
    completed: map["completed"] ?? 0,
    started: map["started"] ?? 0,
  };
}

export async function getUserProgressSummary(userId: string) {
  const rows = await db
    .select({ status: resourceProgress.status, cnt: count() })
    .from(resourceProgress)
    .where(eq(resourceProgress.userId, userId))
    .groupBy(resourceProgress.status);

  const map: Record<string, number> = {};
  for (const r of rows) map[r.status] = r.cnt;

  return {
    completed: map["completed"] ?? 0,
    started: map["started"] ?? 0,
  };
}

export async function getLastAccessedResource(userId: string) {
  const rows = await db
    .select({
      progress: resourceProgress,
      resource: resource,
      topicTitle: topic.title,
      subjectName: subject.name,
      levelTitle: level.title,
    })
    .from(resourceProgress)
    .innerJoin(resource, eq(resourceProgress.resourceId, resource.id))
    .innerJoin(topic, eq(resource.topicId, topic.id))
    .innerJoin(subject, eq(topic.subjectId, subject.id))
    .innerJoin(level, eq(subject.levelId, level.id))
    .where(eq(resourceProgress.userId, userId))
    .orderBy(desc(resourceProgress.lastAccessedAt))
    .limit(1);

  if (!rows.length) return null;
  const row = rows[0];
  return {
    resource: row.resource,
    topicTitle: row.topicTitle,
    subjectName: row.subjectName,
    levelTitle: row.levelTitle,
    lastAccessedAt: row.progress.lastAccessedAt,
    status: row.progress.status,
  };
}

// ============== BOOKMARKS ==============

export async function toggleBookmark(userId: string, resourceId: string): Promise<{ bookmarked: boolean }> {
  const existing = await db
    .select()
    .from(resourceBookmark)
    .where(and(eq(resourceBookmark.userId, userId), eq(resourceBookmark.resourceId, resourceId)))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (existing) {
    await db.delete(resourceBookmark).where(eq(resourceBookmark.id, existing.id));
    return { bookmarked: false };
  }

  await db.insert(resourceBookmark).values({ userId, resourceId });
  return { bookmarked: true };
}

export async function isBookmarked(userId: string, resourceId: string): Promise<boolean> {
  const row = await db
    .select({ id: resourceBookmark.id })
    .from(resourceBookmark)
    .where(and(eq(resourceBookmark.userId, userId), eq(resourceBookmark.resourceId, resourceId)))
    .limit(1)
    .then((r) => r[0] ?? null);
  return !!row;
}

export async function getUserBookmarks(userId: string) {
  const rows = await db
    .select({
      bookmarkId: resourceBookmark.id,
      bookmarkedAt: resourceBookmark.createdAt,
      resource: resource,
      topicTitle: topic.title,
      subjectName: subject.name,
      levelTitle: level.title,
    })
    .from(resourceBookmark)
    .innerJoin(resource, eq(resourceBookmark.resourceId, resource.id))
    .innerJoin(topic, eq(resource.topicId, topic.id))
    .innerJoin(subject, eq(topic.subjectId, subject.id))
    .innerJoin(level, eq(subject.levelId, level.id))
    .where(eq(resourceBookmark.userId, userId))
    .orderBy(desc(resourceBookmark.createdAt));

  return rows;
}

// ============== NOTES ==============

const MAX_NOTE_LENGTH = 4000;

export async function getNoteForResource(userId: string, resourceId: string) {
  return db
    .select()
    .from(resourceNote)
    .where(and(eq(resourceNote.userId, userId), eq(resourceNote.resourceId, resourceId)))
    .limit(1)
    .then((r) => r[0] ?? null);
}

export async function upsertNote(userId: string, resourceId: string, content: string) {
  const trimmed = content.trim().slice(0, MAX_NOTE_LENGTH);

  const existing = await getNoteForResource(userId, resourceId);

  if (existing) {
    if (!trimmed) {
      // Empty content = delete
      await db.delete(resourceNote).where(eq(resourceNote.id, existing.id));
      return null;
    }
    const [updated] = await db
      .update(resourceNote)
      .set({ content: trimmed })
      .where(eq(resourceNote.id, existing.id))
      .returning();
    return updated;
  }

  if (!trimmed) return null;

  const [created] = await db
    .insert(resourceNote)
    .values({ userId, resourceId, content: trimmed })
    .returning();
  return created;
}

export async function deleteNote(userId: string, resourceId: string) {
  await db
    .delete(resourceNote)
    .where(and(eq(resourceNote.userId, userId), eq(resourceNote.resourceId, resourceId)));
}

// ============== RATINGS ==============

export async function rateResource(
  userId: string,
  resourceId: string,
  rating: "up" | "down" | null
) {
  const existing = await db
    .select()
    .from(resourceRating)
    .where(and(eq(resourceRating.userId, userId), eq(resourceRating.resourceId, resourceId)))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (rating === null) {
    // Remove rating
    if (existing) {
      await db.delete(resourceRating).where(eq(resourceRating.id, existing.id));
    }
    return null;
  }

  if (existing) {
    const [updated] = await db
      .update(resourceRating)
      .set({ rating })
      .where(eq(resourceRating.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(resourceRating)
    .values({ userId, resourceId, rating })
    .returning();
  return created;
}

export async function getResourceRatingCounts(resourceId: string): Promise<{ up: number; down: number }> {
  const rows = await db
    .select({ rating: resourceRating.rating, cnt: count() })
    .from(resourceRating)
    .where(eq(resourceRating.resourceId, resourceId))
    .groupBy(resourceRating.rating);

  const map: Record<string, number> = {};
  for (const r of rows) map[r.rating] = r.cnt;
  return { up: map["up"] ?? 0, down: map["down"] ?? 0 };
}

export async function getBulkRatingCounts(resourceIds: string[]): Promise<Map<string, { up: number; down: number }>> {
  if (!resourceIds.length) return new Map();

  const rows = await db
    .select({
      resourceId: resourceRating.resourceId,
      rating: resourceRating.rating,
      cnt: count(),
    })
    .from(resourceRating)
    .where(inArray(resourceRating.resourceId, resourceIds))
    .groupBy(resourceRating.resourceId, resourceRating.rating);

  const map = new Map<string, { up: number; down: number }>();
  for (const r of rows) {
    const existing = map.get(r.resourceId) ?? { up: 0, down: 0 };
    if (r.rating === "up") existing.up = r.cnt;
    else existing.down = r.cnt;
    map.set(r.resourceId, existing);
  }
  return map;
}

export async function getTopRatedResources(limit = 10, ownerIds?: string[]) {
  const query = db
    .select({
      resourceId: resourceRating.resourceId,
      resourceTitle: resource.title,
      resourceType: resource.type,
      topicTitle: topic.title,
      subjectName: subject.name,
      levelTitle: level.title,
      upCount: sql<number>`COALESCE(SUM(CASE WHEN ${resourceRating.rating} = 'up' THEN 1 ELSE 0 END), 0)`,
      downCount: sql<number>`COALESCE(SUM(CASE WHEN ${resourceRating.rating} = 'down' THEN 1 ELSE 0 END), 0)`,
      totalRatings: count(),
    })
    .from(resourceRating)
    .innerJoin(resource, eq(resourceRating.resourceId, resource.id))
    .innerJoin(topic, eq(resource.topicId, topic.id))
    .innerJoin(subject, eq(topic.subjectId, subject.id))
    .innerJoin(level, eq(subject.levelId, level.id));

  const rows = await (ownerIds && ownerIds.length > 0
    ? query.where(inArray(resource.ownerId, ownerIds))
    : query
  )
    .groupBy(
      resourceRating.resourceId,
      resource.title,
      resource.type,
      topic.title,
      subject.name,
      level.title
    )
    .orderBy(sql`COALESCE(SUM(CASE WHEN ${resourceRating.rating} = 'up' THEN 1 ELSE 0 END), 0) DESC`)
    .limit(limit);

  return rows;
}
