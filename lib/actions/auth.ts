"use server";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import type { User, UserRole, UserVerificationStatus } from "@/lib/types";

export async function getUserByClerkId(clerkId: string): Promise<User | null> {
  const result = await db
    .select()
    .from(user)
    .where(eq(user.clerkId, clerkId))
    .limit(1)
    .then(res => res[0] || null);
  return result ?? null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await db
    .select()
    .from(user)
    .where(eq(user.email, email))
    .limit(1)
    .then(res => res[0] || null);
  return result ?? null;
}

export async function createUser(
  clerkId: string,
  email: string,
  role: UserRole = "regular"
): Promise<User> {
  const [newUser] = await db
    .insert(user)
    .values({
      clerkId: clerkId,
      email,
      role,
      // All users are approved immediately (no verification needed)
      verificationStatus: "approved",
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

  const newUser = await createUser(clerkId, email, role || "regular");
  return { user: newUser, isNew: true };
}

export async function updateUserRole(
  clerkId: string,
  role: UserRole,
  userData?: { 
    institutionName?: string; 
    institutionType?: string;
    name?: string;
    level?: string;
  }
): Promise<User> {
  const updateData: Partial<typeof user.$inferInsert> = {
    role,
    onboardingCompleted: true,
    updatedAt: new Date(),
  };

  // All users are auto-approved (no verification needed)
  updateData.verificationStatus = "approved";
  
  // Store institution data for admin users
  if (role === "admin" && userData) {
    updateData.institutionName = userData.institutionName;
    updateData.institutionType = userData.institutionType;
  }
  
  // Store name and level for regular users
  if (role === "regular" && userData) {
    updateData.name = userData.name;
    updateData.level = userData.level;
  }

  const [updatedUser] = await db
    .update(user)
    .set(updateData)
    .where(eq(user.clerkId, clerkId))
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
  // Check the onboardingCompleted flag
  return dbUser.onboardingCompleted;
}

export async function deleteUser(clerkId: string): Promise<void> {
  await db.delete(user).where(eq(user.clerkId, clerkId));
}

export async function getMyDashboardUrl(): Promise<string | null> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;
  const dbUser = await getUserByClerkId(clerkId);
  if (!dbUser) return null;
  switch (dbUser.role) {
    case "super_admin": return "/super-admin";
    case "admin": return "/admin";
    case "regular": return "/regular";
    default: return "/onboarding";
  }
}

export async function checkSuperAdminExists(): Promise<boolean> {
  const result = await db
    .select()
    .from(user)
    .where(eq(user.role, "super_admin"))
    .limit(1)
    .then(res => res[0] || null);
  return result !== null;
}

export async function createAdminUser(
  clerkId: string,
  email: string,
  institutionData?: { institutionName?: string; institutionType?: string }
): Promise<User> {
  const [newAdmin] = await db
    .insert(user)
    .values({
      clerkId: clerkId,
      email,
      role: "admin",
      verificationStatus: "approved",
      onboardingCompleted: true,
      institutionName: institutionData?.institutionName,
      institutionType: institutionData?.institutionType,
    })
    .returning();

  if (!newAdmin) {
    throw new Error("Failed to create admin user");
  }

  return newAdmin;
}

// Note: getAllAdmins has been moved to admin-permissions.ts with full permission support
// Import from @/lib/actions/admin-permissions instead
