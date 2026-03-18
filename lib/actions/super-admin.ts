"use server";

import { db } from "@/lib/db";
import { user, superAdminRegulars } from "@/lib/db/schema";
import { eq, and, inArray, desc, like, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface SuperAdminRegular {
  id: string;
  superAdminId: string;
  regularId: string;
  regularEmail: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  regular?: {
    id: string;
    email: string;
    name: string | null;
    level: string | null;
    createdAt: Date;
  };
}

export interface PaginatedRegulars {
  regulars: SuperAdminRegular[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

// Get paginated regulars for a super-admin
export async function getSuperAdminRegularsPaginated(
  superAdminId: string,
  page: number = 1,
  pageSize: number = 10,
  searchQuery?: string
): Promise<PaginatedRegulars> {
  const offset = (page - 1) * pageSize;

  // Build the where clause
  const whereClause = searchQuery
    ? and(
        eq(superAdminRegulars.superAdminId, superAdminId),
        like(superAdminRegulars.regularEmail, `%${searchQuery}%`)
      )
    : eq(superAdminRegulars.superAdminId, superAdminId);

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(superAdminRegulars)
    .where(whereClause);
  
  const totalCount = countResult[0]?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Get paginated regulars with user details
  const regularsData = await db
    .select({
      sar: superAdminRegulars,
      regularUser: {
        id: user.id,
        email: user.email,
        name: user.name,
        level: user.level,
        createdAt: user.createdAt,
      },
    })
    .from(superAdminRegulars)
    .leftJoin(user, eq(superAdminRegulars.regularId, user.id))
    .where(whereClause)
    .orderBy(desc(superAdminRegulars.createdAt))
    .limit(pageSize)
    .offset(offset);

  const regulars: SuperAdminRegular[] = regularsData.map((row) => ({
    ...row.sar,
    regular: row.regularUser?.id ? row.regularUser : undefined,
  }));

  return {
    regulars,
    totalCount,
    totalPages,
    currentPage: page,
    pageSize,
  };
}

// Add a single regular to super-admin
export async function addSuperAdminRegular(
  superAdminId: string,
  regularEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if user exists with this email and has regular role
    const regularUser = await db
      .select()
      .from(user)
      .where(and(eq(user.email, regularEmail), eq(user.role, "regular")))
      .limit(1)
      .then((res) => res[0] || null);

    if (!regularUser) {
      return {
        success: false,
        error: "No regular user found with this email address",
      };
    }

    // Check if already added
    const existing = await db
      .select()
      .from(superAdminRegulars)
      .where(
        and(
          eq(superAdminRegulars.superAdminId, superAdminId),
          eq(superAdminRegulars.regularId, regularUser.id)
        )
      )
      .limit(1)
      .then((res) => res[0] || null);

    if (existing) {
      return {
        success: false,
        error: "This regular user is already added to your institution",
      };
    }

    // Add the regular
    await db.insert(superAdminRegulars).values({
      superAdminId,
      regularId: regularUser.id,
      regularEmail: regularUser.email,
      isActive: true,
    });

    revalidatePath("/super-admin/regulars");
    revalidatePath("/super-admin", "layout");
    revalidatePath("/regular", "layout");
    return { success: true };
  } catch (error) {
    console.error("Error adding super admin regular:", error);
    return { success: false, error: "Failed to add regular user" };
  }
}

// Remove a single regular from super-admin
export async function removeSuperAdminRegular(
  superAdminId: string,
  regularId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .delete(superAdminRegulars)
      .where(
        and(
          eq(superAdminRegulars.superAdminId, superAdminId),
          eq(superAdminRegulars.regularId, regularId)
        )
      );

    revalidatePath("/super-admin/regulars");
    return { success: true };
  } catch (error) {
    console.error("Error removing super admin regular:", error);
    return { success: false, error: "Failed to remove regular user" };
  }
}

// Bulk add regulars to super-admin
export async function bulkAddSuperAdminRegulars(
  superAdminId: string,
  emails: string[]
): Promise<{
  success: boolean;
  successfullyAdded: string[];
  alreadyExists: string[];
  notFound: string[];
  notRegularRole: string[];
  invalidEmails: string[];
  totalProcessed: number;
}> {
  const successfullyAdded: string[] = [];
  const alreadyExists: string[] = [];
  const notFound: string[] = [];
  const notRegularRole: string[] = [];
  const invalidEmails: string[] = [];

  // Validate emails
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const validEmails = emails.filter((email) => {
    if (!emailRegex.test(email)) {
      invalidEmails.push(email);
      return false;
    }
    return true;
  });

  for (const email of validEmails) {
    // Check if user exists with regular role
    const regularUser = await db
      .select()
      .from(user)
      .where(and(eq(user.email, email), eq(user.role, "regular")))
      .limit(1)
      .then((res) => res[0] || null);

    if (!regularUser) {
      // Check if user exists but is not regular
      const anyUser = await db
        .select()
        .from(user)
        .where(eq(user.email, email))
        .limit(1)
        .then((res) => res[0] || null);

      if (anyUser) {
        notRegularRole.push(email);
      } else {
        notFound.push(email);
      }
      continue;
    }

    // Check if already added
    const existing = await db
      .select()
      .from(superAdminRegulars)
      .where(
        and(
          eq(superAdminRegulars.superAdminId, superAdminId),
          eq(superAdminRegulars.regularId, regularUser.id)
        )
      )
      .limit(1)
      .then((res) => res[0] || null);

    if (existing) {
      alreadyExists.push(email);
      continue;
    }

    // Add the regular
    try {
      await db.insert(superAdminRegulars).values({
        superAdminId,
        regularId: regularUser.id,
        regularEmail: regularUser.email,
        isActive: true,
      });
      successfullyAdded.push(email);
    } catch (error) {
      console.error(`Error adding regular ${email}:`, error);
    }
  }

  revalidatePath("/super-admin/regulars");
  revalidatePath("/super-admin", "layout");
  revalidatePath("/regular", "layout");

  return {
    success: successfullyAdded.length > 0,
    successfullyAdded,
    alreadyExists,
    notFound,
    notRegularRole,
    invalidEmails,
    totalProcessed: emails.length,
  };
}

// Bulk remove regulars from super-admin
export async function bulkRemoveSuperAdminRegulars(
  superAdminId: string,
  regularIds: string[]
): Promise<{
  success: boolean;
  deletedCount: number;
  failedCount: number;
}> {
  let deletedCount = 0;
  let failedCount = 0;

  try {
    const result = await db
      .delete(superAdminRegulars)
      .where(
        and(
          eq(superAdminRegulars.superAdminId, superAdminId),
          inArray(superAdminRegulars.regularId, regularIds)
        )
      )
      .returning();

    deletedCount = result.length;
    failedCount = regularIds.length - deletedCount;

    revalidatePath("/super-admin/regulars");

    return {
      success: deletedCount > 0,
      deletedCount,
      failedCount,
    };
  } catch (error) {
    console.error("Error bulk removing super admin regulars:", error);
    return {
      success: false,
      deletedCount: 0,
      failedCount: regularIds.length,
    };
  }
}

// Get all regulars for a super-admin (non-paginated, for export/admin purposes)
export async function getAllSuperAdminRegulars(
  superAdminId: string
): Promise<SuperAdminRegular[]> {
  const regularsData = await db
    .select({
      sar: superAdminRegulars,
      regularUser: {
        id: user.id,
        email: user.email,
        name: user.name,
        level: user.level,
        createdAt: user.createdAt,
      },
    })
    .from(superAdminRegulars)
    .leftJoin(user, eq(superAdminRegulars.regularId, user.id))
    .where(eq(superAdminRegulars.superAdminId, superAdminId))
    .orderBy(desc(superAdminRegulars.createdAt));

  return regularsData.map((row) => ({
    ...row.sar,
    regular: row.regularUser?.id ? row.regularUser : undefined,
  }));
}
