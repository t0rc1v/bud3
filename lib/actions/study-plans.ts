"use server";

import { db } from "@/lib/db";
import { studyPlan, studyPlanProgress } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function createStudyPlan(params: {
  userId: string;
  title: string;
  subject: string;
  level?: string;
  goals?: unknown;
  schedule?: unknown;
  weeklyHoursTarget?: number;
  startDate?: Date;
  endDate?: Date;
}) {
  const [plan] = await db
    .insert(studyPlan)
    .values({
      userId: params.userId,
      title: params.title,
      subject: params.subject,
      level: params.level,
      goals: params.goals,
      schedule: params.schedule,
      weeklyHoursTarget: params.weeklyHoursTarget,
      startDate: params.startDate || new Date(),
      endDate: params.endDate,
    })
    .returning();
  return plan;
}

export async function getStudyPlansByUser(userId: string) {
  return db
    .select()
    .from(studyPlan)
    .where(and(eq(studyPlan.userId, userId), eq(studyPlan.isActive, true)))
    .orderBy(desc(studyPlan.createdAt));
}

export async function getActiveStudyPlan(userId: string) {
  const [plan] = await db
    .select()
    .from(studyPlan)
    .where(
      and(
        eq(studyPlan.userId, userId),
        eq(studyPlan.status, "active"),
        eq(studyPlan.isActive, true)
      )
    )
    .orderBy(desc(studyPlan.createdAt))
    .limit(1);
  return plan || null;
}

export async function getStudyPlanById(planId: string) {
  const [plan] = await db
    .select()
    .from(studyPlan)
    .where(eq(studyPlan.id, planId));
  return plan || null;
}

export async function updateStudyPlan(
  planId: string,
  data: Partial<{
    title: string;
    status: "active" | "completed" | "paused";
    goals: unknown;
    schedule: unknown;
    weeklyHoursTarget: number;
    endDate: Date;
  }>
) {
  const [updated] = await db
    .update(studyPlan)
    .set(data)
    .where(eq(studyPlan.id, planId))
    .returning();
  return updated;
}

export async function logStudyPlanProgress(params: {
  planId: string;
  userId: string;
  activitiesCompleted?: unknown;
  timeSpentMinutes?: number;
  notes?: string;
}) {
  const [progress] = await db
    .insert(studyPlanProgress)
    .values({
      planId: params.planId,
      userId: params.userId,
      activitiesCompleted: params.activitiesCompleted,
      timeSpentMinutes: params.timeSpentMinutes,
      notes: params.notes,
    })
    .returning();
  return progress;
}

export async function getStudyPlanProgress(planId: string) {
  return db
    .select()
    .from(studyPlanProgress)
    .where(eq(studyPlanProgress.planId, planId))
    .orderBy(desc(studyPlanProgress.date));
}
