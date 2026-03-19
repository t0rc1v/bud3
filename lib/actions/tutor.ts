"use server";

import { db } from "@/lib/db";
import { tutorSession } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export async function createTutorSession(params: {
  userId: string;
  chatId: string;
  subject: string;
  topic: string;
  level?: string;
  mode: "socratic" | "guided" | "practice";
}) {
  const [session] = await db
    .insert(tutorSession)
    .values({
      userId: params.userId,
      chatId: params.chatId,
      subject: params.subject,
      topic: params.topic,
      level: params.level,
      mode: params.mode,
      misconceptions: [],
      conceptsMastered: [],
      sessionStats: { questionsAsked: 0, correctAnswers: 0 },
    })
    .returning();
  return session;
}

export async function updateTutorSession(
  sessionId: string,
  data: Partial<{
    misconceptions: unknown;
    conceptsMastered: unknown;
    sessionStats: unknown;
  }>
) {
  const [updated] = await db
    .update(tutorSession)
    .set(data)
    .where(eq(tutorSession.id, sessionId))
    .returning();
  return updated;
}

export async function endTutorSession(sessionId: string) {
  const [ended] = await db
    .update(tutorSession)
    .set({ status: "completed" })
    .where(eq(tutorSession.id, sessionId))
    .returning();
  return ended;
}

export async function getTutorSessionsByUser(userId: string) {
  return db
    .select()
    .from(tutorSession)
    .where(and(eq(tutorSession.userId, userId), eq(tutorSession.isActive, true)))
    .orderBy(desc(tutorSession.createdAt));
}

export async function getTutorSessionById(sessionId: string) {
  const [session] = await db
    .select()
    .from(tutorSession)
    .where(eq(tutorSession.id, sessionId));
  return session || null;
}

export async function getTutorSessionByChatId(chatId: string) {
  const [session] = await db
    .select()
    .from(tutorSession)
    .where(and(eq(tutorSession.chatId, chatId), eq(tutorSession.status, "active")));
  return session || null;
}

export async function updateTutorProgress(
  sessionId: string,
  action: "correct" | "incorrect" | "attempt" | "new_question"
) {
  const session = await getTutorSessionById(sessionId);
  if (!session) return null;

  const stats = (session.sessionStats as Record<string, number>) || {};
  let currentQuestionAttempts = stats.currentQuestionAttempts ?? 0;
  let correctStreak = stats.correctStreak ?? 0;
  let wrongStreak = stats.wrongStreak ?? 0;
  let totalQuestions = stats.questionsAsked ?? 0;
  let totalCorrect = stats.correctAnswers ?? 0;

  switch (action) {
    case "correct":
      totalCorrect++;
      correctStreak++;
      wrongStreak = 0;
      currentQuestionAttempts = 0;
      totalQuestions++;
      break;
    case "incorrect":
      wrongStreak++;
      correctStreak = 0;
      totalQuestions++;
      break;
    case "attempt":
      currentQuestionAttempts++;
      break;
    case "new_question":
      currentQuestionAttempts = 0;
      break;
  }

  const updatedStats = {
    questionsAsked: totalQuestions,
    correctAnswers: totalCorrect,
    currentQuestionAttempts,
    correctStreak,
    wrongStreak,
  };

  await updateTutorSession(sessionId, { sessionStats: updatedStats });

  return {
    currentQuestionAttempts,
    correctStreak,
    wrongStreak,
    totalQuestions,
    totalCorrect,
    hintRecommended: currentQuestionAttempts >= 3,
    levelUpRecommended: correctStreak >= 5,
    miniLessonRecommended: wrongStreak >= 3,
  };
}

export async function getTutorSessionStats(userId: string) {
  const [stats] = await db
    .select({
      totalSessions: sql<number>`count(*)`,
      completedSessions: sql<number>`count(*) filter (where ${tutorSession.status} = 'completed')`,
      activeSessions: sql<number>`count(*) filter (where ${tutorSession.status} = 'active')`,
    })
    .from(tutorSession)
    .where(and(eq(tutorSession.userId, userId), eq(tutorSession.isActive, true)));

  return stats;
}
