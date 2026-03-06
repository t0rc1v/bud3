import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getLevelsFullHierarchy } from "@/lib/actions/admin";
import { getUserByClerkId } from "@/lib/actions/auth";
import { getRegularAdminIds } from "@/lib/actions/admin";
import { db } from "@/lib/db";
import { unlockFee, unlockedContent } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { DEFAULT_CREDIT_CONFIG } from "@/lib/mpesa";
import type { LevelWithFullHierarchy, SubjectWithTopics, TopicWithResources, Resource } from "@/lib/types";
import type { UserRole } from "@/lib/types";

/**
 * Check if user can access content based on ownership rules:
 * - Super-admin content: visible to all (view-only for non-owners)
 * - Admin content: visible to the admin + their regulars only (not other admins)
 * - Regular content: visible to themselves only
 * - Regular users with multiple admins: can view content from ALL their admins
 */
function canAccessContent(
  contentOwnerId: string | null,
  contentOwnerRole: UserRole,
  contentVisibility: string,
  userId: string,
  userRole: UserRole,
  userAdminIds: string[]
): boolean {
  // Super-admin can access everything
  if (userRole === "super_admin") return true;

  // Owner can always access their own content
  if (contentOwnerId === userId) return true;

  // Super-admin content is viewable by everyone
  if (contentOwnerRole === "super_admin") return true;

  // Check based on content owner role
  if (contentOwnerRole === "admin") {
    // Admin content: only visible to admin + their regulars
    if (userRole === "admin") {
      // Admins can only see their own content, not other admins'
      return contentOwnerId === userId;
    }
    if (userRole === "regular") {
      // Regular can see if they belong to this admin
      return contentOwnerId !== null && userAdminIds.includes(contentOwnerId);
    }
    return false;
  }

  if (contentOwnerRole === "regular") {
    // Regular content: only visible to themselves
    return contentOwnerId === userId;
  }

  // For content without a clear owner role, check visibility settings
  // BUT still enforce that admins can only see their own content
  switch (contentVisibility) {
    case "public":
      return true;
    case "admin_only":
      // For admin_only visibility, only the owner admin should see it
      // NOT other admins
      if (userRole === "admin") {
        return contentOwnerId === userId;
      }
      return userRole === "super_admin" as UserRole;
    case "admin_and_regulars":
      if (userRole === "admin") {
        // Admins can only see their own admin_and_regulars content
        return contentOwnerId === userId;
      }
      if (userRole === "regular" && contentOwnerId !== null) {
        return contentOwnerId === userId || userAdminIds.includes(contentOwnerId);
      }
      return userRole === "super_admin" as UserRole;
    case "regular_only":
      if (userRole === "regular" && contentOwnerId !== null) {
        return contentOwnerId === userId || userAdminIds.includes(contentOwnerId);
      }
      return false;
    default:
      // Default: if ownerRole is not set, only allow if user is the owner
      return contentOwnerId === userId;
  }
}

/**
 * Filter resources based on ownership
 */
function filterResources(
  resources: Resource[],
  userId: string,
  userRole: UserRole,
  userAdminIds: string[]
): Resource[] {
  return resources.filter((resource) =>
    canAccessContent(
      resource.ownerId,
      resource.ownerRole,
      resource.visibility,
      userId,
      userRole,
      userAdminIds
    )
  );
}

/**
 * Filter topics based on ownership (and their resources)
 */
function filterTopics(
  topics: TopicWithResources[],
  userId: string,
  userRole: UserRole,
  userAdminIds: string[]
): TopicWithResources[] {
  return topics
    .filter((topic) =>
      canAccessContent(
        topic.ownerId,
        topic.ownerRole,
        topic.visibility,
        userId,
        userRole,
        userAdminIds
      )
    )
    .map((topic) => ({
      ...topic,
      resources: filterResources(topic.resources || [], userId, userRole, userAdminIds),
    }));
}

/**
 * Filter subjects based on ownership (and their topics)
 */
function filterSubjects(
  subjects: SubjectWithTopics[],
  userId: string,
  userRole: UserRole,
  userAdminIds: string[]
): SubjectWithTopics[] {
  return subjects
    .filter((subject) =>
      canAccessContent(
        subject.ownerId,
        subject.ownerRole,
        subject.visibility,
        userId,
        userRole,
        userAdminIds
      )
    )
    .map((subject) => ({
      ...subject,
      topics: filterTopics(subject.topics || [], userId, userRole, userAdminIds),
    }));
}

/**
 * Filter levels based on ownership (and their subjects)
 */
function filterLevels(
  levels: LevelWithFullHierarchy[],
  userId: string,
  userRole: UserRole,
  userAdminIds: string[]
): LevelWithFullHierarchy[] {
  return levels
    .filter((level) =>
      canAccessContent(
        level.ownerId,
        level.ownerRole,
        level.visibility,
        userId,
        userRole,
        userAdminIds
      )
    )
    .map((level) => ({
      ...level,
      subjects: filterSubjects(level.subjects || [], userId, userRole, userAdminIds),
    }));
}

/**
 * GET /api/content/hierarchy-with-unlock-status
 * Returns content hierarchy with unlock status for the current user
 * Respects content ownership: super-admin content is public, admin content is for admin + their regulars, regular content is private
 */
export async function GET(req: Request) {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user details from database
    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const userRole = user.role as UserRole;
    const userDbId = user.id;

    // Get admin IDs for regular users (supports multiple admins)
    const userAdminIds = userRole === "regular" ? await getRegularAdminIds(userDbId) : [];

    // Learners see only published resources; admins/super-admins see all
    const levels = await getLevelsFullHierarchy({ publishedOnly: userRole === "regular" });

    // Filter levels based on ownership
    const filteredLevels = filterLevels(levels, userDbId, userRole, userAdminIds);

    // Collect all visible resource IDs to batch-load fees and unlocks
    const resourceIds = filteredLevels.flatMap(l =>
      (l.subjects || []).flatMap(s =>
        (s.topics || []).flatMap(t =>
          (t.resources || []).map(r => r.id)
        )
      )
    );

    // Batch-load unlock fees and user unlocks in 2 queries instead of O(N) per-resource calls
    // Note: uses userDbId (DB UUID) — not clerkId — to query unlockedContent.userId (UUID column)
    const [allFees, userUnlocks] = await Promise.all([
      resourceIds.length > 0
        ? db.select().from(unlockFee).where(
            and(
              inArray(unlockFee.resourceId, resourceIds),
              eq(unlockFee.isActive, true)
            )
          )
        : [],
      db
        .select({ unlockFeeId: unlockedContent.unlockFeeId })
        .from(unlockedContent)
        .where(eq(unlockedContent.userId, userDbId)),
    ]);

    const feeByResourceId = new Map(allFees.map(f => [f.resourceId!, f]));
    const unlockedFeeIds = new Set(userUnlocks.map(u => u.unlockFeeId));

    const levelsWithUnlockStatus = filteredLevels.map((level) => ({
      id: level.id,
      title: level.title,
      ownerId: level.ownerId,
      subjects: (level.subjects || []).map((subject) => ({
        id: subject.id,
        name: subject.name,
        ownerId: subject.ownerId,
        topics: (subject.topics || []).map((topic) => ({
          id: topic.id,
          title: topic.title,
          ownerId: topic.ownerId,
          resources: (topic.resources || []).map((resource) => {
            const fee = feeByResourceId.get(resource.id);
            const feeAmount = fee?.feeAmount ?? DEFAULT_CREDIT_CONFIG.defaultUnlockFeeKes;
            const isUnlocked = fee ? unlockedFeeIds.has(fee.id) : false;
            return {
              id: resource.id,
              title: resource.title,
              type: resource.type,
              // SECURITY: Only expose URL if content is unlocked
              url: isUnlocked ? resource.url : null,
              description: resource.description,
              unlockFee: feeAmount,
              isUnlocked,
              ownerId: resource.ownerId,
            };
          }),
        })),
      })),
    }));

    return NextResponse.json({
      levels: levelsWithUnlockStatus,
    });

  } catch (error) {
    console.error("Content hierarchy with unlock status error:", error);
    return NextResponse.json(
      { error: "Failed to load content" },
      { status: 500 }
    );
  }
}
