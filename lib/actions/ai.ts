"use server";

import { db } from "@/lib/db";
import { chat, chatMessage, aiMemory } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface Chat {
  id: string;
  userId: string;
  title: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  role: "user" | "assistant" | "tool";
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIMemoryItem {
  id: string;
  userId: string;
  title: string;
  category: string | null;
  content: Record<string, unknown>;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}



export async function createChat({
  userId,
  title,
}: {
  userId: string;
  title: string;
}): Promise<Chat> {
  const result = await db
    .insert(chat)
    .values({
      userId,
      title,
      isActive: true,
    })
    .returning();

  return result[0];
}

export async function getUserChats(userId: string): Promise<Chat[]> {
  const chats = await db
    .select()
    .from(chat)
    .where(and(eq(chat.userId, userId), eq(chat.isActive, true)))
    .orderBy(desc(chat.updatedAt));

  return chats;
}

export async function getChatMessages(chatId: string): Promise<ChatMessage[]> {
  const messages = await db
    .select()
    .from(chatMessage)
    .where(eq(chatMessage.chatId, chatId))
    .orderBy(chatMessage.createdAt);

  return messages.map(m => ({
    ...m,
    role: m.role as "user" | "assistant" | "tool",
    metadata: m.metadata as Record<string, unknown> | undefined,
  }));
}

export async function saveChatMessage({
  chatId,
  role,
  content,
  metadata,
}: {
  chatId: string;
  role: "user" | "assistant" | "tool";
  content: string;
  metadata?: Record<string, unknown>;
}): Promise<ChatMessage> {
  const result = await db
    .insert(chatMessage)
    .values({
      chatId,
      role,
      content,
      metadata: metadata || {},
    })
    .returning();

  // Update the chat's updatedAt timestamp
  await db
    .update(chat)
    .set({ updatedAt: new Date() })
    .where(eq(chat.id, chatId));

  const saved = result[0];
  return {
    ...saved,
    role: saved.role as "user" | "assistant" | "tool",
    metadata: saved.metadata as Record<string, unknown> | undefined,
  };
}

export async function deleteChat(chatId: string): Promise<void> {
  await db.delete(chat).where(eq(chat.id, chatId));
  revalidatePath("/");
}

export async function getMemoryItems(userId: string): Promise<AIMemoryItem[]> {
  const items = await db
    .select()
    .from(aiMemory)
    .where(and(eq(aiMemory.userId, userId), eq(aiMemory.isActive, true)))
    .orderBy(desc(aiMemory.updatedAt));

  return items.map(item => ({
    ...item,
    content: item.content as Record<string, unknown>,
  }));
}

export async function getMemoryItemsByCategory(
  userId: string,
  category: string
): Promise<AIMemoryItem[]> {
  const items = await db
    .select()
    .from(aiMemory)
    .where(
      and(
        eq(aiMemory.userId, userId),
        eq(aiMemory.category, category),
        eq(aiMemory.isActive, true)
      )
    )
    .orderBy(desc(aiMemory.updatedAt));

  return items.map(item => ({
    ...item,
    content: item.content as Record<string, unknown>,
  }));
}

export async function saveMemoryItem({
  userId,
  title,
  category,
  content,
  description,
}: {
  userId: string;
  title: string;
  category: string;
  content: Record<string, unknown>;
  description?: string;
}): Promise<AIMemoryItem> {
  const result = await db
    .insert(aiMemory)
    .values({
      userId,
      title,
      category,
      content,
      description: description || null,
      isActive: true,
    })
    .returning();

  const saved = result[0];
  return {
    ...saved,
    content: saved.content as Record<string, unknown>,
  };
}

export async function updateMemoryItem({
  id,
  title,
  category,
  content,
  description,
}: {
  id: string;
  title?: string;
  category?: string;
  content?: Record<string, unknown>;
  description?: string;
}): Promise<AIMemoryItem> {
  const updateData: Partial<typeof aiMemory.$inferInsert> = {};
  if (title !== undefined) updateData.title = title;
  if (category !== undefined) updateData.category = category;
  if (content !== undefined) updateData.content = content;
  if (description !== undefined) updateData.description = description;
  updateData.updatedAt = new Date();

  const result = await db
    .update(aiMemory)
    .set(updateData)
    .where(eq(aiMemory.id, id))
    .returning();

  const saved = result[0];
  return {
    ...saved,
    content: saved.content as Record<string, unknown>,
  };
}

export async function deleteMemoryItem(id: string): Promise<void> {
  await db.update(aiMemory).set({ isActive: false }).where(eq(aiMemory.id, id));
}


