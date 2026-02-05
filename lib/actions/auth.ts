"use server";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { User, UserRole } from "@/lib/types";

export async function getUserByClerkId(clerkId: string): Promise<User | null> {
  const result = await db.query.user.findFirst({
    where: eq(user.userId, clerkId),
  });
  return result ?? null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await db.query.user.findFirst({
    where: eq(user.email, email),
  });
  return result ?? null;
}

export async function createUser(
  clerkId: string,
  email: string,
  role: UserRole = "learner"
): Promise<User> {
  const [newUser] = await db
    .insert(user)
    .values({
      userId: clerkId,
      email,
      role,
    })
    .returning();

  if (!newUser) {
    throw new Error("Failed to create user");
  }

  return newUser;
}

export async function getOrCreateUser(
  clerkId: string,
  email: string,
  role?: UserRole
): Promise<{ user: User; isNew: boolean }> {
  const existingUser = await getUserByClerkId(clerkId);

  if (existingUser) {
    return { user: existingUser, isNew: false };
  }

  const newUser = await createUser(clerkId, email, role || "learner");
  return { user: newUser, isNew: true };
}

export async function updateUserRole(
  clerkId: string,
  role: UserRole
): Promise<User> {
  const [updatedUser] = await db
    .update(user)
    .set({
      role,
      updatedAt: new Date(),
    })
    .where(eq(user.userId, clerkId))
    .returning();

  if (!updatedUser) {
    throw new Error("User not found");
  }

  revalidatePath("/onboarding");
  return updatedUser;
}

export async function hasUserCompletedOnboarding(clerkId: string): Promise<boolean> {
  const dbUser = await getUserByClerkId(clerkId);
  // If user doesn't exist in DB, they haven't completed onboarding
  if (!dbUser) return false;
  // If role is still default learner and user was just created, they might need onboarding
  // But for now, existence in DB means they've been processed
  return true;
}

export async function deleteUser(clerkId: string): Promise<void> {
  await db.delete(user).where(eq(user.userId, clerkId));
}
