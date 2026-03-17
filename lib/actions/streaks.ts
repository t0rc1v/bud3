"use server";

import { db } from "@/lib/db";
import { userStreak } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getUserStreak(userId: string) {
  const [streak] = await db
    .select()
    .from(userStreak)
    .where(eq(userStreak.userId, userId))
    .limit(1);

  if (!streak) {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: null };
  }

  return streak;
}

export async function updateStreak(userId: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  const existing = await db
    .select()
    .from(userStreak)
    .where(eq(userStreak.userId, userId))
    .limit(1)
    .then(res => res[0] || null);

  if (!existing) {
    // First activity ever
    const [created] = await db
      .insert(userStreak)
      .values({
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: today,
      })
      .returning();
    return created;
  }

  const lastActive = existing.lastActiveDate
    ? new Date(
        existing.lastActiveDate.getFullYear(),
        existing.lastActiveDate.getMonth(),
        existing.lastActiveDate.getDate()
      )
    : null;

  // Already recorded today
  if (lastActive && lastActive.getTime() === today.getTime()) {
    return existing;
  }

  let newCurrent: number;
  if (lastActive && lastActive.getTime() === yesterday.getTime()) {
    // Consecutive day
    newCurrent = existing.currentStreak + 1;
  } else {
    // Streak broken — start fresh
    newCurrent = 1;
  }

  const newLongest = Math.max(existing.longestStreak, newCurrent);

  const [updated] = await db
    .update(userStreak)
    .set({
      currentStreak: newCurrent,
      longestStreak: newLongest,
      lastActiveDate: today,
    })
    .where(eq(userStreak.userId, userId))
    .returning();

  return updated;
}

