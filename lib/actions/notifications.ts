"use server";

import { db } from "@/lib/db";
import { notification } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function createNotification({
  userId,
  type,
  title,
  body,
  metadata,
}: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  metadata?: Record<string, unknown>;
}) {
  const [created] = await db
    .insert(notification)
    .values({ userId, type, title, body, metadata })
    .returning();
  return created;
}

export async function getUnreadNotifications(userId: string, limit = 20) {
  return db
    .select()
    .from(notification)
    .where(and(eq(notification.userId, userId), eq(notification.isRead, false)))
    .orderBy(desc(notification.createdAt))
    .limit(limit);
}

export async function markNotificationRead(notificationId: string, userId: string) {
  const [updated] = await db
    .update(notification)
    .set({ isRead: true })
    .where(and(eq(notification.id, notificationId), eq(notification.userId, userId)))
    .returning();
  return updated;
}

export async function markAllNotificationsRead(userId: string) {
  await db
    .update(notification)
    .set({ isRead: true })
    .where(and(eq(notification.userId, userId), eq(notification.isRead, false)));
}
