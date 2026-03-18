import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getLevelsFullHierarchy,
  getRegularAdminIds,
  getRegularSuperAdminId,
  getAdminSuperAdminId,
  getSuperAdminAdminIds,
  getSuperAdminRegularIds,
} from "@/lib/actions/admin";
import { getUserByClerkId } from "@/lib/actions/auth";
import type { LevelWithFullHierarchy, SubjectWithTopics, TopicWithResources, Resource } from "@/lib/types";
import type { UserRole } from "@/lib/types";

/**
 * Build the set of owner IDs whose content this user is allowed to see.
 *
 * Ownership rules:
 * - Super-admin: own + their owned admins + their owned regulars
 * - Admin: own + their super-admin's content
 * - Regular: own + direct admins (adminRegulars) + their super-admin + super-admin's admins
 */
async function buildAllowedOwnerIds(
  userId: string,
  userRole: UserRole
): Promise<Set<string>> {
  const allowed = new Set<string>([userId]);

  if (userRole === "super_admin") {
    const [ownedAdminIds, ownedRegularIds] = await Promise.all([
      getSuperAdminAdminIds(userId),
      getSuperAdminRegularIds(userId),
    ]);
    ownedAdminIds.forEach((id) => allowed.add(id));
    ownedRegularIds.forEach((id) => allowed.add(id));
  } else if (userRole === "admin") {
    const superAdminId = await getAdminSuperAdminId(userId);
    if (superAdminId) allowed.add(superAdminId);
  } else if (userRole === "regular") {
    // Direct admin relationships (adminRegulars table)
    const adminIds = await getRegularAdminIds(userId);
    adminIds.forEach((id) => allowed.add(id));

    // Super-admin hierarchy (superAdminRegulars table)
    const superAdminId = await getRegularSuperAdminId(userId);
    if (superAdminId) {
      allowed.add(superAdminId);
      const superAdminAdminIds = await getSuperAdminAdminIds(superAdminId);
      superAdminAdminIds.forEach((id) => allowed.add(id));
    }
  }

  return allowed;
}

/**
 * Check if user can access content based on ownership + visibility rules.
 */
function canAccessContent(
  contentOwnerId: string | null,
  contentVisibility: string,
  userRole: UserRole,
  allowedOwnerIds: Set<string>
): boolean {
  // Public content is visible to all authenticated users
  if (contentVisibility === "public") return true;

  // Content must have an owner to be accessible
  if (!contentOwnerId) return false;

  // Content owner must be in the user's allowed set
  if (!allowedOwnerIds.has(contentOwnerId)) return false;

  // Additional visibility restrictions within the ownership set
  if (contentVisibility === "admin_only" && userRole === "regular") return false;
  if (contentVisibility === "regular_only" && userRole === "admin") return false;

  return true;
}

/**
 * Filter resources based on ownership
 */
function filterResources(
  resources: Resource[],
  userRole: UserRole,
  allowedOwnerIds: Set<string>
): Resource[] {
  return resources.filter((resource) =>
    canAccessContent(resource.ownerId, resource.visibility, userRole, allowedOwnerIds)
  );
}

/**
 * Filter topics based on ownership (and their resources)
 */
function filterTopics(
  topics: TopicWithResources[],
  userRole: UserRole,
  allowedOwnerIds: Set<string>
): TopicWithResources[] {
  return topics
    .filter((topic) =>
      canAccessContent(topic.ownerId, topic.visibility, userRole, allowedOwnerIds)
    )
    .map((topic) => ({
      ...topic,
      resources: filterResources(topic.resources || [], userRole, allowedOwnerIds),
    }));
}

/**
 * Filter subjects based on ownership (and their topics)
 */
function filterSubjects(
  subjects: SubjectWithTopics[],
  userRole: UserRole,
  allowedOwnerIds: Set<string>
): SubjectWithTopics[] {
  return subjects
    .filter((subject) =>
      canAccessContent(subject.ownerId, subject.visibility, userRole, allowedOwnerIds)
    )
    .map((subject) => ({
      ...subject,
      topics: filterTopics(subject.topics || [], userRole, allowedOwnerIds),
    }));
}

/**
 * Filter levels based on ownership (and their subjects)
 */
function filterLevels(
  levels: LevelWithFullHierarchy[],
  userRole: UserRole,
  allowedOwnerIds: Set<string>
): LevelWithFullHierarchy[] {
  return levels
    .filter((level) =>
      canAccessContent(level.ownerId, level.visibility, userRole, allowedOwnerIds)
    )
    .map((level) => ({
      ...level,
      subjects: filterSubjects(level.subjects || [], userRole, allowedOwnerIds),
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

    // Build the set of owner IDs whose content this user can see
    const allowedOwnerIds = await buildAllowedOwnerIds(userDbId, userRole);

    // Learners see only published resources; admins/super-admins see all
    const levels = await getLevelsFullHierarchy({ publishedOnly: userRole === "regular" });

    // Filter levels based on ownership
    const filteredLevels = filterLevels(levels, userRole, allowedOwnerIds);

    const levelsWithStatus = filteredLevels.map((level) => ({
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
          resources: (topic.resources || []).map((resource) => ({
            id: resource.id,
            title: resource.title,
            type: resource.type,
            url: resource.url,
            description: resource.description,
            ownerId: resource.ownerId,
          })),
        })),
      })),
    }));

    return NextResponse.json({
      levels: levelsWithStatus,
    });

  } catch (error) {
    console.error("Content hierarchy with unlock status error:", error);
    return NextResponse.json(
      { error: "Failed to load content" },
      { status: 500 }
    );
  }
}
