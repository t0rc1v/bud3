"use server";

import { db } from "@/lib/db";
import { chat, chatMessage, aiMemory, aiAssignment, aiQuiz, aiQuizAttempt, aiFlashcard } from "@/lib/db/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface Chat {
  id: string;
  userId: string;
  title: string;
  isActive: boolean;
  visibility: 'private' | 'link';
  shareToken: string | null;
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



function toChat(row: typeof chat.$inferSelect): Chat {
  return {
    ...row,
    visibility: (row.visibility as 'private' | 'link') ?? 'private',
    shareToken: row.shareToken ?? null,
  };
}

export async function createChat({
  id,
  userId,
  title,
}: {
  id?: string;
  userId: string;
  title: string;
}): Promise<Chat> {
  const result = await db
    .insert(chat)
    .values({ ...(id ? { id } : {}), userId, title, isActive: true })
    .returning();

  return toChat(result[0]);
}

export async function getUserChats(userId: string): Promise<Chat[]> {
  const chats = await db
    .select()
    .from(chat)
    .where(and(eq(chat.userId, userId), eq(chat.isActive, true)))
    .orderBy(desc(chat.updatedAt));

  return chats.map(toChat);
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

export async function updateChatTitle({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}): Promise<Chat> {
  const result = await db
    .update(chat)
    .set({
      title,
      updatedAt: new Date(),
    })
    .where(eq(chat.id, chatId))
    .returning();

  revalidatePath("/");
  return toChat(result[0]);
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

// AI Assignment Interfaces
export interface AIAssignmentItem {
  id: string;
  userId: string;
  chatId: string | null;
  title: string;
  subject: string;
  level: string;
  type: string;
  instructions: string;
  totalMarks: number;
  timeLimit: number | null;
  dueDate: Date | null;
  includeAnswerKey: boolean;
  questions: unknown;
  answerKey: unknown | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// AI Quiz Interfaces
export interface AIQuizItem {
  id: string;
  userId: string;
  chatId: string | null;
  title: string;
  subject: string;
  description: string | null;
  instructions: string;
  totalMarks: number;
  passingScore: number;
  timeLimit: number | null;
  settings: unknown;
  questions: unknown;
  validation: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIQuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  answers: unknown;
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  timeTaken: number | null;
  completedAt: Date;
  createdAt: Date;
}

// Save AI Generated Assignment
export async function saveAIAssignment({
  userId,
  chatId,
  title,
  subject,
  level,
  type,
  instructions,
  totalMarks,
  timeLimit,
  dueDate,
  includeAnswerKey,
  questions,
  answerKey,
}: {
  userId: string;
  chatId?: string;
  title: string;
  subject: string;
  level: string;
  type: string;
  instructions: string;
  totalMarks: number;
  timeLimit?: number;
  dueDate?: string;
  includeAnswerKey: boolean;
  questions: unknown[];
  answerKey?: unknown;
}): Promise<AIAssignmentItem> {
  const result = await db
    .insert(aiAssignment)
    .values({
      userId,
      chatId: chatId || null,
      title,
      subject,
      level,
      type,
      instructions,
      totalMarks,
      timeLimit: timeLimit || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      includeAnswerKey,
      questions,
      answerKey: answerKey || null,
      isActive: true,
    })
    .returning();

  const saved = result[0];
  return {
    ...saved,
    questions: saved.questions as unknown,
    answerKey: saved.answerKey as unknown,
  };
}

// Get AI Assignment by ID
export async function getAIAssignmentById(id: string): Promise<AIAssignmentItem | null> {
  const result = await db
    .select()
    .from(aiAssignment)
    .where(and(eq(aiAssignment.id, id), eq(aiAssignment.isActive, true)))
    .limit(1);

  if (result.length === 0) return null;

  const item = result[0];
  return {
    ...item,
    questions: item.questions as unknown,
    answerKey: item.answerKey as unknown,
  };
}

// Get AI Assignments by User
export async function getAIAssignmentsByUser(userId: string): Promise<AIAssignmentItem[]> {
  const items = await db
    .select()
    .from(aiAssignment)
    .where(and(eq(aiAssignment.userId, userId), eq(aiAssignment.isActive, true)))
    .orderBy(desc(aiAssignment.createdAt));

  return items.map(item => ({
    ...item,
    questions: item.questions as unknown,
    answerKey: item.answerKey as unknown,
  }));
}

// Save AI Generated Quiz
export async function saveAIQuiz({
  userId,
  chatId,
  title,
  subject,
  description,
  instructions,
  totalMarks,
  passingScore,
  timeLimit,
  settings,
  questions,
  validation,
}: {
  userId: string;
  chatId?: string;
  title: string;
  subject: string;
  description?: string;
  instructions: string;
  totalMarks: number;
  passingScore: number;
  timeLimit?: number | null;
  settings: unknown;
  questions: unknown[];
  validation: unknown;
}): Promise<AIQuizItem> {
  const result = await db
    .insert(aiQuiz)
    .values({
      userId,
      chatId: chatId || null,
      title,
      subject,
      description: description || null,
      instructions,
      totalMarks,
      passingScore,
      timeLimit: timeLimit || null,
      settings,
      questions,
      validation,
      isActive: true,
    })
    .returning();

  const saved = result[0];
  return {
    ...saved,
    settings: saved.settings as unknown,
    questions: saved.questions as unknown,
    validation: saved.validation as unknown,
  };
}

// Get AI Quiz by ID
export async function getAIQuizById(id: string): Promise<AIQuizItem | null> {
  const result = await db
    .select()
    .from(aiQuiz)
    .where(and(eq(aiQuiz.id, id), eq(aiQuiz.isActive, true)))
    .limit(1);

  if (result.length === 0) return null;

  const item = result[0];
  return {
    ...item,
    settings: item.settings as unknown,
    questions: item.questions as unknown,
    validation: item.validation as unknown,
  };
}

// Get AI Quizzes by User
export async function getAIQuizzesByUser(userId: string): Promise<AIQuizItem[]> {
  const items = await db
    .select()
    .from(aiQuiz)
    .where(and(eq(aiQuiz.userId, userId), eq(aiQuiz.isActive, true)))
    .orderBy(desc(aiQuiz.createdAt));

  return items.map(item => ({
    ...item,
    settings: item.settings as unknown,
    questions: item.questions as unknown,
    validation: item.validation as unknown,
  }));
}

// Save Quiz Attempt
export async function saveQuizAttempt({
  quizId,
  userId,
  answers,
  score,
  totalMarks,
  percentage,
  passed,
  timeTaken,
}: {
  quizId: string;
  userId: string;
  answers: unknown;
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  timeTaken?: number;
}): Promise<AIQuizAttempt> {
  const result = await db
    .insert(aiQuizAttempt)
    .values({
      quizId,
      userId,
      answers,
      score,
      totalMarks,
      percentage,
      passed,
      timeTaken: timeTaken || null,
      completedAt: new Date(),
    })
    .returning();

  const saved = result[0];
  return {
    ...saved,
    answers: saved.answers as unknown,
  };
}

// Get Quiz Attempts by Quiz and User
export async function getQuizAttemptsByQuiz(quizId: string, userId: string): Promise<AIQuizAttempt[]> {
  const attempts = await db
    .select()
    .from(aiQuizAttempt)
    .where(and(eq(aiQuizAttempt.quizId, quizId), eq(aiQuizAttempt.userId, userId)))
    .orderBy(desc(aiQuizAttempt.completedAt));

  return attempts.map(attempt => ({
    ...attempt,
    answers: attempt.answers as unknown,
  }));
}

// Delete AI Assignment (soft delete)
export async function deleteAIAssignment(id: string): Promise<void> {
  await db.update(aiAssignment).set({ isActive: false }).where(eq(aiAssignment.id, id));
}

// Delete AI Quiz (soft delete)
export async function deleteAIQuiz(id: string): Promise<void> {
  await db.update(aiQuiz).set({ isActive: false }).where(eq(aiQuiz.id, id));
}

// AI Flashcard Interfaces
export interface AIFlashcardItem {
  id: string;
  userId: string;
  chatId: string | null;
  title: string;
  subject: string;
  topic: string | null;
  totalCards: number;
  cards: unknown;
  settings: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FlashcardData {
  id: string;
  front: string;
  back: string;
  tags?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
}

// Save AI Generated Flashcards
export async function saveAIFlashcards({
  userId,
  chatId,
  title,
  subject,
  topic,
  totalCards,
  cards,
  settings,
}: {
  userId: string;
  chatId?: string;
  title: string;
  subject: string;
  topic?: string;
  totalCards: number;
  cards: FlashcardData[];
  settings?: unknown;
}): Promise<AIFlashcardItem> {
  const result = await db
    .insert(aiFlashcard)
    .values({
      userId,
      chatId: chatId || null,
      title,
      subject,
      topic: topic || null,
      totalCards,
      cards,
      settings: settings || null,
      isActive: true,
    })
    .returning();

  const saved = result[0];
  return {
    ...saved,
    cards: saved.cards as unknown,
    settings: saved.settings as unknown,
  };
}

// Get AI Flashcard by ID
export async function getAIFlashcardById(id: string): Promise<AIFlashcardItem | null> {
  const result = await db
    .select()
    .from(aiFlashcard)
    .where(and(eq(aiFlashcard.id, id), eq(aiFlashcard.isActive, true)))
    .limit(1);

  if (result.length === 0) return null;

  const item = result[0];
  return {
    ...item,
    cards: item.cards as unknown,
    settings: item.settings as unknown,
  };
}

// Get AI Flashcards by User
export async function getAIFlashcardsByUser(userId: string): Promise<AIFlashcardItem[]> {
  const items = await db
    .select()
    .from(aiFlashcard)
    .where(and(eq(aiFlashcard.userId, userId), eq(aiFlashcard.isActive, true)))
    .orderBy(desc(aiFlashcard.createdAt));

  return items.map(item => ({
    ...item,
    cards: item.cards as unknown,
    settings: item.settings as unknown,
  }));
}

// Delete AI Flashcard (soft delete)
export async function deleteAIFlashcard(id: string): Promise<void> {
  await db.update(aiFlashcard).set({ isActive: false }).where(eq(aiFlashcard.id, id));
}

// UUID format validation helper
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function deleteChatMessagesFrom({
  chatId,
  fromMessageId,
}: {
  chatId: string;
  fromMessageId: string;
}): Promise<void> {
  // Find the createdAt timestamp of the target message
  const target = await db
    .select({ createdAt: chatMessage.createdAt })
    .from(chatMessage)
    .where(and(eq(chatMessage.id, fromMessageId), eq(chatMessage.chatId, chatId)))
    .limit(1);

  if (target.length === 0) return;

  // Delete all messages in this chat from that timestamp onward
  await db
    .delete(chatMessage)
    .where(and(eq(chatMessage.chatId, chatId), gte(chatMessage.createdAt, target[0].createdAt)));
}

export async function generateChatShareToken({
  chatId,
  userId,
}: {
  chatId: string;
  userId: string;
}): Promise<{ shareToken: string }> {
  // Check if token already exists — never regenerate (would break existing links)
  const existing = await db
    .select({ shareToken: chat.shareToken })
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)))
    .limit(1);

  if (existing.length > 0 && existing[0].shareToken) {
    return { shareToken: existing[0].shareToken };
  }

  const shareToken = crypto.randomUUID();
  await db
    .update(chat)
    .set({ visibility: 'link', shareToken, updatedAt: new Date() })
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)));

  return { shareToken };
}

export async function updateChatVisibility({
  chatId,
  userId,
  visibility,
}: {
  chatId: string;
  userId: string;
  visibility: 'private' | 'link';
}): Promise<void> {
  await db
    .update(chat)
    .set({
      visibility,
      // Revoking: null out the token so old links stop working
      shareToken: visibility === 'private' ? null : undefined,
      updatedAt: new Date(),
    })
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)));
}

export async function getChatByShareToken(
  token: string
): Promise<{ chat: Chat; messages: ChatMessage[] } | null> {
  if (!UUID_REGEX.test(token)) return null;

  const chatRows = await db
    .select()
    .from(chat)
    .where(and(eq(chat.shareToken, token), eq(chat.visibility, 'link'), eq(chat.isActive, true)))
    .limit(1);

  if (chatRows.length === 0) return null;

  const foundChat = chatRows[0];
  const messages = await db
    .select()
    .from(chatMessage)
    .where(eq(chatMessage.chatId, foundChat.id))
    .orderBy(chatMessage.createdAt);

  return {
    chat: {
      ...foundChat,
      visibility: foundChat.visibility as 'private' | 'link',
      shareToken: foundChat.shareToken,
    },
    messages: messages.map(m => ({
      ...m,
      role: m.role as 'user' | 'assistant' | 'tool',
      metadata: m.metadata as Record<string, unknown> | undefined,
    })),
  };
}
