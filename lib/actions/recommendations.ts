"use server";

import { db } from "@/lib/db";
import {
  resourceProgress,
  resourceRating,
  resourceView,
  resource,
  topic,
  subject,
  weaknessProfile,
} from "@/lib/db/schema";
import { eq, and, ne, sql, desc, inArray } from "drizzle-orm";

/**
 * Collaborative filtering + weakness-boosted recommendations.
 *
 * Strategy:
 * 1. Find topics the user has interacted with
 * 2. Find other users who interacted with similar topics
 * 3. Get resources those users rated positively but current user hasn't seen
 * 4. Boost resources from weak topics
 */
export async function getRecommendations(userId: string, limit: number = 10) {
  // Step 1: Get topics the user has viewed
  const userViews = await db
    .select({ resourceId: resourceView.resourceId })
    .from(resourceView)
    .where(eq(resourceView.userId, userId));

  const viewedResourceIds = userViews.map((v) => v.resourceId);

  // Step 2: Get resources the user hasn't seen, ordered by popularity
  const conditions = [
    eq(resource.isActive, true),
    eq(resource.status, "published"),
  ];

  if (viewedResourceIds.length > 0) {
    // Exclude already-viewed resources
    conditions.push(
      sql`${resource.id} NOT IN (${sql.join(
        viewedResourceIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    );
  }

  // Get popular resources the user hasn't seen
  const popular = await db
    .select({
      id: resource.id,
      title: resource.title,
      description: resource.description,
      type: resource.type,
      topicTitle: topic.title,
      subjectName: subject.name,
      viewCount: sql<number>`(
        SELECT count(*) FROM resource_view rv WHERE rv.resource_id = ${resource.id}
      )`,
      positiveRatings: sql<number>`(
        SELECT count(*) FROM resource_rating rr WHERE rr.resource_id = ${resource.id} AND rr.rating = 'up'
      )`,
    })
    .from(resource)
    .leftJoin(topic, eq(resource.topicId, topic.id))
    .leftJoin(subject, eq(resource.subjectId, subject.id))
    .where(and(...conditions))
    .orderBy(desc(sql`(
      SELECT count(*) FROM resource_rating rr WHERE rr.resource_id = ${resource.id} AND rr.rating = 'up'
    )`))
    .limit(limit * 2); // Fetch more to allow re-ranking

  // Step 3: Boost resources from weak topics
  const weaknesses = await db
    .select({ subject: weaknessProfile.subject, score: weaknessProfile.weaknessScore })
    .from(weaknessProfile)
    .where(and(eq(weaknessProfile.userId, userId), eq(weaknessProfile.isActive, true)));

  const weakSubjects = new Set(
    weaknesses.filter((w) => w.score > 50).map((w) => w.subject.toLowerCase())
  );

  // Re-rank: boost weak-topic resources
  const scored = popular.map((r) => {
    let score = (r.positiveRatings || 0) * 2 + (r.viewCount || 0);
    if (r.subjectName && weakSubjects.has(r.subjectName.toLowerCase())) {
      score *= 1.5; // 50% boost for weak subjects
    }
    return {
      ...r,
      recommendationScore: score,
      reason: weakSubjects.has((r.subjectName || "").toLowerCase())
        ? "Recommended to strengthen a weak area"
        : "Popular among other learners",
    };
  });

  scored.sort((a, b) => b.recommendationScore - a.recommendationScore);

  return scored.slice(0, limit).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    type: r.type,
    topic: r.topicTitle,
    subject: r.subjectName,
    reason: r.reason,
  }));
}
