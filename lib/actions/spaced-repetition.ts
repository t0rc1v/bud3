"use server";

import { db } from "@/lib/db";
import { flashcardReview } from "@/lib/db/schema";
import { eq, and, lte, sql } from "drizzle-orm";

/**
 * SM-2 algorithm implementation for spaced repetition.
 *
 * Rating mapping:
 *   again = 0, hard = 3, good = 4, easy = 5
 *
 * easeFactor is stored as integer ×1000 (e.g. 2500 = 2.5)
 */

const RATING_MAP: Record<string, number> = {
  again: 0,
  hard: 3,
  good: 4,
  easy: 5,
};

function sm2(
  quality: number,
  prevInterval: number,
  prevEaseFactor: number, // ×1000
  prevReviewCount: number
): { interval: number; easeFactor: number } {
  let ef = prevEaseFactor;

  // Update ease factor (minimum 1300 = 1.3)
  ef = ef + (80 - 5 * (5 - quality) * (5 - quality + 14));
  if (ef < 1300) ef = 1300;

  let interval: number;
  if (quality < 3) {
    // Reset on failure
    interval = 1;
  } else if (prevReviewCount <= 1) {
    interval = 1;
  } else if (prevReviewCount === 2) {
    interval = 6;
  } else {
    interval = Math.round(prevInterval * (ef / 1000));
  }

  return { interval, easeFactor: ef };
}

export async function reviewFlashcard(params: {
  flashcardSetId: string;
  userId: string;
  cardId: string;
  rating: "again" | "hard" | "good" | "easy";
}) {
  // Find existing review for this card
  const existing = await db
    .select()
    .from(flashcardReview)
    .where(
      and(
        eq(flashcardReview.flashcardSetId, params.flashcardSetId),
        eq(flashcardReview.userId, params.userId),
        eq(flashcardReview.cardId, params.cardId)
      )
    )
    .limit(1);

  const quality = RATING_MAP[params.rating];
  const prev = existing[0];
  const prevInterval = prev?.interval ?? 0;
  const prevEaseFactor = prev?.easeFactor ?? 2500;
  const prevReviewCount = prev?.reviewCount ?? 0;

  const { interval, easeFactor } = sm2(
    quality,
    prevInterval,
    prevEaseFactor,
    prevReviewCount
  );

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);

  if (prev) {
    // Update existing review
    const [updated] = await db
      .update(flashcardReview)
      .set({
        rating: params.rating,
        interval,
        easeFactor,
        nextReviewDate,
        reviewCount: prevReviewCount + 1,
      })
      .where(eq(flashcardReview.id, prev.id))
      .returning();
    return updated;
  }

  // Create new review
  const [review] = await db
    .insert(flashcardReview)
    .values({
      flashcardSetId: params.flashcardSetId,
      userId: params.userId,
      cardId: params.cardId,
      rating: params.rating,
      interval,
      easeFactor,
      nextReviewDate,
      reviewCount: 1,
    })
    .returning();

  return review;
}

export async function getDueFlashcards(
  userId: string,
  flashcardSetId?: string
) {
  const conditions = [
    eq(flashcardReview.userId, userId),
    lte(flashcardReview.nextReviewDate, new Date()),
  ];

  if (flashcardSetId) {
    conditions.push(eq(flashcardReview.flashcardSetId, flashcardSetId));
  }

  return db
    .select()
    .from(flashcardReview)
    .where(and(...conditions))
    .orderBy(flashcardReview.nextReviewDate);
}

export async function getFlashcardStats(
  userId: string,
  flashcardSetId: string
) {
  const [stats] = await db
    .select({
      totalReviews: sql<number>`count(*)`,
      dueCount: sql<number>`count(*) filter (where ${flashcardReview.nextReviewDate} <= now())`,
      avgEaseFactor: sql<number>`coalesce(avg(${flashcardReview.easeFactor}), 2500)`,
    })
    .from(flashcardReview)
    .where(
      and(
        eq(flashcardReview.userId, userId),
        eq(flashcardReview.flashcardSetId, flashcardSetId)
      )
    );

  return stats;
}
