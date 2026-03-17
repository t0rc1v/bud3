"use server";

import { db } from "@/lib/db";
import { weaknessProfile, aiQuizAttempt, aiQuiz } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

/**
 * Analyse quiz attempts and grades per topic to build a weakness profile.
 * weaknessScore 0 = strong, 100 = very weak.
 */
export async function analyzeWeaknesses(userId: string) {
  // Aggregate quiz performance by subject
  const quizPerformance = await db
    .select({
      subject: aiQuiz.subject,
      avgPercentage: sql<number>`avg(${aiQuizAttempt.percentage})`,
      attemptCount: sql<number>`count(*)`,
    })
    .from(aiQuizAttempt)
    .innerJoin(aiQuiz, eq(aiQuizAttempt.quizId, aiQuiz.id))
    .where(eq(aiQuizAttempt.userId, userId))
    .groupBy(aiQuiz.subject);

  const profiles = [];

  for (const perf of quizPerformance) {
    const weaknessScore = Math.max(0, Math.min(100, 100 - perf.avgPercentage));

    // Upsert weakness profile
    const existing = await db
      .select()
      .from(weaknessProfile)
      .where(
        and(
          eq(weaknessProfile.userId, userId),
          eq(weaknessProfile.subject, perf.subject)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(weaknessProfile)
        .set({
          weaknessScore,
          evidenceData: {
            avgPercentage: perf.avgPercentage,
            attemptCount: perf.attemptCount,
          },
          lastAssessedAt: new Date(),
        })
        .where(eq(weaknessProfile.id, existing[0].id))
        .returning();
      profiles.push(updated);
    } else {
      const [created] = await db
        .insert(weaknessProfile)
        .values({
          userId,
          subject: perf.subject,
          weaknessScore,
          evidenceData: {
            avgPercentage: perf.avgPercentage,
            attemptCount: perf.attemptCount,
          },
        })
        .returning();
      profiles.push(created);
    }
  }

  return profiles;
}

export async function getWeaknessProfile(userId: string) {
  return db
    .select()
    .from(weaknessProfile)
    .where(
      and(eq(weaknessProfile.userId, userId), eq(weaknessProfile.isActive, true))
    )
    .orderBy(desc(weaknessProfile.weaknessScore));
}
