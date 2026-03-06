"use server";

import { db } from "@/lib/db";
import { level, subject, topic, resource, adminRegulars, user, unlockedContent, unlockFee, superAdminAdmins, superAdminRegulars } from "@/lib/db/schema";
import { getUserByClerkId } from "@/lib/actions/auth";
import { hasUserUnlockedContent, getUnlockFeeByResource } from "@/lib/actions/credits";
import { eq, and, desc, asc, inArray, or, isNull, count, ilike } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import type {
  CreateLevelInput,
  UpdateLevelInput,
  CreateSubjectInput,
  UpdateSubjectInput,
  CreateTopicInput,
  UpdateTopicInput,
  CreateResourceInput,
  UpdateResourceInput,
  LevelWithSubjects,
  SubjectWithTopics,
  TopicWithResources,
  TopicWithResourcesAndSubject,
  ResourceWithRelations,
  LevelWithFullHierarchy,
  LevelWithFullHierarchyAndUnlockStatus,
  SubjectWithTopicsAndLevel,
  Level,
  Subject,
  Topic,
  Resource,
  User,
  UserRole,
} from "@/lib/types";

// ==========================================
// CONTENT VISIBILITY & OWNERSHIP UTILITIES
// ==========================================

/**
 * Get the admin IDs for a regular user (supports multiple admins via old table)
 * Note: This is kept for backward compatibility, but new logic uses superAdminRegulars
 */
export async function getRegularAdminIds(regularId: string): Promise<string[]> {
  const adminRegularsList = await db
    .select()
    .from(adminRegulars)
    .where(eq(adminRegulars.regularId, regularId));
  return adminRegularsList.map(ar => ar.adminId);
}

/**
 * Get the super-admin ID for a regular user (new hierarchy)
 */
export async function getRegularSuperAdminId(regularId: string): Promise<string | null> {
  const result = await db
    .select()
    .from(superAdminRegulars)
    .where(eq(superAdminRegulars.regularId, regularId))
    .limit(1)
    .then(res => res[0] || null);
  return result?.superAdminId || null;
}

/**
 * Get the super-admin ID for an admin user
 */
export async function getAdminSuperAdminId(adminId: string): Promise<string | null> {
  const result = await db
    .select()
    .from(superAdminAdmins)
    .where(eq(superAdminAdmins.adminId, adminId))
    .limit(1)
    .then(res => res[0] || null);
  return result?.superAdminId || null;
}

/**
 * Get all admin IDs for a super-admin (new hierarchy)
 */
export async function getSuperAdminAdminIds(superAdminId: string): Promise<string[]> {
  const superAdminAdminsList = await db
    .select()
    .from(superAdminAdmins)
    .where(eq(superAdminAdmins.superAdminId, superAdminId));
  return superAdminAdminsList.map(sa => sa.adminId);
}

/**
 * Get all regular IDs for a super-admin (new hierarchy)
 */
export async function getSuperAdminRegularIds(superAdminId: string): Promise<string[]> {
  const superAdminRegularsList = await db
    .select()
    .from(superAdminRegulars)
    .where(eq(superAdminRegulars.superAdminId, superAdminId));
  return superAdminRegularsList.map(sr => sr.regularId);
}

/**
 * Build visibility filter for content queries based on new ownership hierarchy:
 * - Super-admin: sees own + their admins' + their regulars' content
 * - Admin: sees own + their super-admin's content
 * - Regular: sees own + their super-admin's + their super-admin's admins' content
 * 
 * Management rule: users can only manage (CRUD) their own content regardless of role
 */
export async function buildContentVisibilityFilter(
  userId: string,
  userRole: UserRole,
  adminIds: string[] = []
): Promise<ReturnType<typeof or> | undefined> {
  if (userRole === "super_admin") {
    // Super-admin sees own + their admins' + their regulars' content
    const superAdminAdminIds = await getSuperAdminAdminIds(userId);
    const superAdminRegularIds = await getSuperAdminRegularIds(userId);
    
    const conditions = [
      eq(level.ownerId, userId),
      eq(level.ownerRole, "super_admin"),
    ];
    
    // Add admins' content
    if (superAdminAdminIds.length > 0) {
      superAdminAdminIds.forEach(adminId => {
        conditions.push(eq(level.ownerId, adminId));
      });
    }
    
    // Add regulars' content
    if (superAdminRegularIds.length > 0) {
      superAdminRegularIds.forEach(regularId => {
        conditions.push(eq(level.ownerId, regularId));
      });
    }
    
    conditions.push(eq(level.visibility, "public"));
    
    return or(...conditions);
  }

  if (userRole === "admin") {
    // Find the super-admin this admin belongs to
    const superAdminResult = await db
      .select()
      .from(superAdminAdmins)
      .where(eq(superAdminAdmins.adminId, userId))
      .limit(1)
      .then(res => res[0] || null);
    
    const superAdminId = superAdminResult?.superAdminId;
    
    // Admin sees:
    // 1. Their own content (can manage)
    // 2. Their super-admin's content (view-only)
    // 3. Public visibility content
    const conditions = [
      eq(level.ownerId, userId),
      eq(level.visibility, "public"),
    ];
    
    if (superAdminId) {
      conditions.push(eq(level.ownerId, superAdminId));
    }
    
    return or(...conditions);
  }

  // Regular user sees:
  // 1. Their own content (can manage)
  // 2. Their super-admin's content (view-only)
  // 3. Their super-admin's admins' content (view-only)
  // 4. Public visibility content
  const superAdminId = await getRegularSuperAdminId(userId);
  const conditions: ReturnType<typeof eq>[] = [
    eq(level.ownerId, userId),
    eq(level.visibility, "public"),
  ];
  
  if (superAdminId) {
    // Add super-admin's content
    conditions.push(eq(level.ownerId, superAdminId));
    
    // Add super-admin's admins' content
    const superAdminAdminIds = await getSuperAdminAdminIds(superAdminId);
    if (superAdminAdminIds.length > 0) {
      superAdminAdminIds.forEach(adminId => {
        conditions.push(eq(level.ownerId, adminId));
      });
    }
  }
  
  // Also support old adminRegulars table for backward compatibility
  if (adminIds.length > 0) {
    adminIds.forEach(adminId => {
      conditions.push(eq(level.ownerId, adminId));
    });
  }

  return or(...conditions);
}

/**
 * Check if a user can access specific content based on new ownership hierarchy:
 * - Super-admin: can access own + their admins' + their regulars' content
 * - Admin: can access own + their super-admin's content
 * - Regular: can access own + their super-admin's + their super-admin's admins' content
 */
export async function canAccessContent(
  contentOwnerId: string,
  contentOwnerRole: UserRole,
  contentVisibility: string,
  userId: string,
  userRole: UserRole
): Promise<boolean> {
  // Super-admin can access own + their admins' + their regulars' content
  if (userRole === "super_admin") {
    if (contentOwnerId === userId) return true;
    
    // Check if content owner is one of this super-admin's admins
    const superAdminAdminIds = await getSuperAdminAdminIds(userId);
    if (superAdminAdminIds.includes(contentOwnerId)) return true;
    
    // Check if content owner is one of this super-admin's regulars
    const superAdminRegularIds = await getSuperAdminRegularIds(userId);
    if (superAdminRegularIds.includes(contentOwnerId)) return true;
    
    return false;
  }

  // Owner can always access their own content
  if (contentOwnerId === userId) return true;

  if (userRole === "admin") {
    // Find this admin's super-admin
    const superAdminResult = await db
      .select()
      .from(superAdminAdmins)
      .where(eq(superAdminAdmins.adminId, userId))
      .limit(1)
      .then(res => res[0] || null);
    
    const superAdminId = superAdminResult?.superAdminId;
    
    // Admin can access their super-admin's content
    if (contentOwnerId === superAdminId) return true;
    
    // Check visibility settings for other content
    switch (contentVisibility) {
      case "public":
        return true;
      default:
        // For all other cases, only allow if user is the owner (already checked above)
        return false;
    }
  }

  if (userRole === "regular") {
    // Find this regular's super-admin
    const superAdminId = await getRegularSuperAdminId(userId);
    
    if (superAdminId) {
      // Regular can access their super-admin's content
      if (contentOwnerId === superAdminId) return true;
      
      // Regular can access their super-admin's admins' content
      const superAdminAdminIds = await getSuperAdminAdminIds(superAdminId);
      if (superAdminAdminIds.includes(contentOwnerId)) return true;
    }
    
    // Support old adminRegulars table for backward compatibility
    const adminIds = await getRegularAdminIds(userId);
    if (adminIds.includes(contentOwnerId)) return true;
    
    // Check visibility settings
    switch (contentVisibility) {
      case "public":
        return true;
      default:
        return false;
    }
  }

  return false;
}

/**
 * Check if user can modify content (only owner can modify)
 */
export async function canModifyContent(
  contentOwnerId: string,
  userId: string,
  userRole: UserRole
): Promise<boolean> {
  // Super-admin can modify anything
  if (userRole === "super_admin") return true;
  // Only owner can modify
  return contentOwnerId === userId;
}

// ==========================================
// LEVEL ACTIONS WITH OWNERSHIP
// ==========================================

export async function getLevelsForUser(
  userId: string,
  userRole: UserRole
): Promise<LevelWithFullHierarchyAndUnlockStatus[]> {
  const adminIds = userRole === "regular" ? await getRegularAdminIds(userId) : [];
  
  const visibilityFilter = await buildContentVisibilityFilter(userId, userRole, adminIds);
  
  // Fetch levels
  const levelsData = await db
    .select()
    .from(level)
    .where(visibilityFilter || undefined)
    .orderBy(asc(level.order));
  
  // Fetch all subjects for these levels
  const levelIds = levelsData.map(l => l.id);
  const subjectsData = levelIds.length > 0 
    ? await db
        .select()
        .from(subject)
        .where(inArray(subject.levelId, levelIds))
        .orderBy(asc(subject.name))
    : [];
  
  // Fetch all topics for these subjects
  const subjectIds = subjectsData.map(s => s.id);
  const topicsData = subjectIds.length > 0
    ? await db
        .select()
        .from(topic)
        .where(inArray(topic.subjectId, subjectIds))
        .orderBy(asc(topic.order))
    : [];
  
  // Fetch all resources for these topics
  const topicIds = topicsData.map(t => t.id);
  const resourcesData = topicIds.length > 0
    ? await db
        .select()
        .from(resource)
        .where(inArray(resource.topicId, topicIds))
        .orderBy(desc(resource.createdAt))
    : [];

  // Fetch all unlock fees for these resources in one query
  const resourceIds = resourcesData.map(r => r.id);
  const unlockFeesData = resourceIds.length > 0
    ? await db
        .select()
        .from(unlockFee)
        .where(and(
          inArray(unlockFee.resourceId, resourceIds),
          eq(unlockFee.isActive, true)
        ))
    : [];

  // Create a map of resourceId to unlockFeeId
  const resourceIdToUnlockFeeId = new Map<string, string>();
  unlockFeesData.forEach(fee => {
    if (fee.resourceId) {
      resourceIdToUnlockFeeId.set(fee.resourceId, fee.id);
    }
  });

  // Fetch all unlocked content for this user in one query
  const unlockFeeIds = unlockFeesData.map(fee => fee.id);
  const unlockedContentData = unlockFeeIds.length > 0
    ? await db
        .select()
        .from(unlockedContent)
        .where(and(
          eq(unlockedContent.userId, userId),
          inArray(unlockedContent.unlockFeeId, unlockFeeIds)
        ))
    : [];

  // Create a set of unlocked unlockFeeIds for quick lookup
  const unlockedFeeIds = new Set(unlockedContentData.map(uc => uc.unlockFeeId));
  
  // Assemble the hierarchy with unlock status
  const levels = levelsData.map(l => ({
    ...l,
    subjects: subjectsData
      .filter(s => s.levelId === l.id)
      .map(s => ({
        ...s,
        topics: topicsData
          .filter(t => t.subjectId === s.id)
          .map(t => ({
            ...t,
            resources: resourcesData
              .filter(r => r.topicId === t.id)
              .map(r => {
                const unlockFeeId = resourceIdToUnlockFeeId.get(r.id);
                const isUnlocked = unlockFeeId ? unlockedFeeIds.has(unlockFeeId) : false;
                return {
                  ...r,
                  isUnlocked,
                };
              }),
          })),
      })),
  }));
  
  return levels as unknown as LevelWithFullHierarchyAndUnlockStatus[];
}

export async function getLevelByIdWithAccessCheck(
  id: string,
  userId: string,
  userRole: UserRole
): Promise<LevelWithSubjects | null> {
  const levelData = await db
    .select()
    .from(level)
    .where(eq(level.id, id))
    .limit(1)
    .then(res => res[0] || null);

  if (!levelData) return null;

  const subjectsData = await db
    .select()
    .from(subject)
    .where(eq(subject.levelId, id))
    .orderBy(asc(subject.name));

  const hasAccess = await canAccessContent(
    levelData.ownerId || "",
    levelData.ownerRole,
    levelData.visibility,
    userId,
    userRole
  );

  const levelWithSubjects = {
    ...levelData,
    subjects: subjectsData,
  };

  return hasAccess ? (levelWithSubjects as unknown as LevelWithSubjects) : null;
}

export async function createLevel(input: CreateLevelInput): Promise<Level> {
  const [newLevel] = await db
    .insert(level)
    .values({
      levelNumber: input.levelNumber,
      title: input.title,
      order: input.order,
      color: input.color,
      ownerId: input.ownerId,
      ownerRole: input.ownerRole,
      visibility: input.visibility,
      isActive: true,
    })
    .returning();

  revalidatePath("/admin");
  revalidatePath("/regular");
  return newLevel;
}

export async function updateLevel(
  input: UpdateLevelInput,
  userId: string,
  userRole: UserRole
): Promise<void> {
  const { id, ...data } = input;

  // Check ownership
  const existingLevel = await db
    .select()
    .from(level)
    .where(eq(level.id, id))
    .limit(1)
    .then(res => res[0] || null);

  if (!existingLevel) {
    throw new Error("Level not found");
  }

  const canModify = await canModifyContent(
    existingLevel.ownerId || "",
    userId,
    userRole
  );

  if (!canModify) {
    throw new Error("You don't have permission to modify this level");
  }

  await db
    .update(level)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(level.id, id));

  revalidatePath("/admin");
  revalidatePath("/regular");
}

export async function deleteLevel(
  id: string,
  userId: string,
  userRole: UserRole
): Promise<void> {
  // Check ownership
  const existingLevel = await db
    .select()
    .from(level)
    .where(eq(level.id, id))
    .limit(1)
    .then(res => res[0] || null);

  if (!existingLevel) {
    throw new Error("Level not found");
  }

  const canModify = await canModifyContent(
    existingLevel.ownerId || "",
    userId,
    userRole
  );

  if (!canModify) {
    throw new Error("You don't have permission to delete this level");
  }

  // Delete the level (cascade will handle subjects, topics, resources)
  await db.delete(level).where(eq(level.id, id));
  revalidatePath("/admin");
  revalidatePath("/regular");
}

// ==========================================
// SUBJECT ACTIONS WITH OWNERSHIP
// ==========================================

export async function getSubjectsForUser(
  userId: string,
  userRole: UserRole
): Promise<SubjectWithTopics[]> {
  const adminIds = userRole === "regular" ? await getRegularAdminIds(userId) : [];

  // Build conditions based on role and ownership rules
  const conditions = [];

  if (userRole === "super_admin") {
    // Super-admin sees all subjects
    const subjectsData = await db
      .select()
      .from(subject)
      .orderBy(asc(subject.name));
    
    const subjectIds = subjectsData.map(s => s.id);
    const topicsData = subjectIds.length > 0
      ? await db
          .select()
          .from(topic)
          .where(inArray(topic.subjectId, subjectIds))
          .orderBy(asc(topic.order))
      : [];
    
    const topicIds = topicsData.map(t => t.id);
    const resourcesData = topicIds.length > 0
      ? await db
          .select()
          .from(resource)
          .where(inArray(resource.topicId, topicIds))
          .orderBy(desc(resource.createdAt))
      : [];
    
    const subjects = subjectsData.map(s => ({
      ...s,
      topics: topicsData
        .filter(t => t.subjectId === s.id)
        .map(t => ({
          ...t,
          resources: resourcesData.filter(r => r.topicId === t.id),
        })),
    }));
    
    return subjects as unknown as SubjectWithTopics[];
  }

  if (userRole === "admin") {
    // Admin sees: own content + super-admin content + public
    conditions.push(
      eq(subject.ownerId, userId),
      eq(subject.ownerRole, "super_admin"),
      eq(subject.visibility, "public")
    );
  } else {
    // Regular sees: own content + super-admin content + public + all admins' content
    conditions.push(
      eq(subject.ownerId, userId),
      eq(subject.ownerRole, "super_admin"),
      eq(subject.visibility, "public")
    );
    
    // Add conditions for each admin the regular belongs to
    adminIds.forEach(adminId => {
      conditions.push(eq(subject.ownerId, adminId));
    });
  }

  const subjectsData = await db
    .select()
    .from(subject)
    .where(or(...conditions))
    .orderBy(asc(subject.name));
  
  const subjectIds = subjectsData.map(s => s.id);
  const topicsData = subjectIds.length > 0
    ? await db
        .select()
        .from(topic)
        .where(inArray(topic.subjectId, subjectIds))
        .orderBy(asc(topic.order))
    : [];
  
  const topicIds = topicsData.map(t => t.id);
  const resourcesData = topicIds.length > 0
    ? await db
        .select()
        .from(resource)
        .where(inArray(resource.topicId, topicIds))
        .orderBy(desc(resource.createdAt))
    : [];
  
  const subjects = subjectsData.map(s => ({
    ...s,
    topics: topicsData
      .filter(t => t.subjectId === s.id)
      .map(t => ({
        ...t,
        resources: resourcesData.filter(r => r.topicId === t.id),
      })),
  }));

  return subjects as unknown as SubjectWithTopics[];
}

export async function createSubject(input: CreateSubjectInput): Promise<Subject> {
  const [newSubject] = await db
    .insert(subject)
    .values({
      levelId: input.levelId,
      name: input.name,
      icon: input.icon,
      color: input.color,
      ownerId: input.ownerId,
      ownerRole: input.ownerRole,
      visibility: input.visibility,
      isActive: true,
    })
    .returning();

  revalidatePath("/admin");
  revalidatePath("/regular");
  return newSubject;
}

export async function updateSubject(
  input: UpdateSubjectInput,
  userId: string,
  userRole: UserRole
): Promise<void> {
  const { id, ...data } = input;

  const existingSubject = await db
    .select()
    .from(subject)
    .where(eq(subject.id, id))
    .limit(1)
    .then(res => res[0] || null);

  if (!existingSubject) {
    throw new Error("Subject not found");
  }

  const canModify = await canModifyContent(
    existingSubject.ownerId || "",
    userId,
    userRole
  );

  if (!canModify) {
    throw new Error("You don't have permission to modify this subject");
  }

  await db
    .update(subject)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(subject.id, id));

  revalidatePath("/admin");
  revalidatePath("/regular");
}

export async function deleteSubject(
  id: string,
  userId: string,
  userRole: UserRole
): Promise<void> {
  const existingSubject = await db
    .select()
    .from(subject)
    .where(eq(subject.id, id))
    .limit(1)
    .then(res => res[0] || null);

  if (!existingSubject) {
    throw new Error("Subject not found");
  }

  const canModify = await canModifyContent(
    existingSubject.ownerId || "",
    userId,
    userRole
  );

  if (!canModify) {
    throw new Error("You don't have permission to delete this subject");
  }

  await db.delete(subject).where(eq(subject.id, id));
  revalidatePath("/admin");
  revalidatePath("/regular");
}

// ==========================================
// TOPIC ACTIONS WITH OWNERSHIP
// ==========================================

export async function getTopicsForUser(
  userId: string,
  userRole: UserRole
): Promise<TopicWithResources[]> {
  const adminIds = userRole === "regular" ? await getRegularAdminIds(userId) : [];

  // Build conditions based on role and ownership rules
  const conditions = [];

  if (userRole === "super_admin") {
    // Super-admin sees all topics
    const topicsData = await db
      .select()
      .from(topic)
      .orderBy(asc(topic.order));
    
    const topicIds = topicsData.map(t => t.id);
    const resourcesData = topicIds.length > 0
      ? await db
          .select()
          .from(resource)
          .where(inArray(resource.topicId, topicIds))
          .orderBy(desc(resource.createdAt))
      : [];
    
    const topics = topicsData.map(t => ({
      ...t,
      resources: resourcesData.filter(r => r.topicId === t.id),
    }));
    
    return topics;
  }

  if (userRole === "admin") {
    // Admin sees: own content + super-admin content + public
    conditions.push(
      eq(topic.ownerId, userId),
      eq(topic.ownerRole, "super_admin"),
      eq(topic.visibility, "public")
    );
  } else {
    // Regular sees: own content + super-admin content + public + all admins' content
    conditions.push(
      eq(topic.ownerId, userId),
      eq(topic.ownerRole, "super_admin"),
      eq(topic.visibility, "public")
    );
    
    // Add conditions for each admin the regular belongs to
    adminIds.forEach(adminId => {
      conditions.push(eq(topic.ownerId, adminId));
    });
  }

  const topicsData = await db
    .select()
    .from(topic)
    .where(or(...conditions))
    .orderBy(asc(topic.order));
  
  const topicIds = topicsData.map(t => t.id);
  const resourcesData = topicIds.length > 0
    ? await db
        .select()
        .from(resource)
        .where(inArray(resource.topicId, topicIds))
        .orderBy(desc(resource.createdAt))
    : [];
  
  const topics = topicsData.map(t => ({
    ...t,
    resources: resourcesData.filter(r => r.topicId === t.id),
  }));

  return topics;
}

export async function createTopic(input: CreateTopicInput): Promise<Topic> {
  const [newTopic] = await db
    .insert(topic)
    .values({
      subjectId: input.subjectId,
      title: input.title,
      order: input.order,
      ownerId: input.ownerId,
      ownerRole: input.ownerRole,
      visibility: input.visibility,
      isActive: true,
    })
    .returning();

  revalidatePath("/admin");
  revalidatePath("/regular");
  return newTopic;
}

export async function updateTopic(
  input: UpdateTopicInput,
  userId: string,
  userRole: UserRole
): Promise<void> {
  const { id, ...data } = input;

  const existingTopic = await db
    .select()
    .from(topic)
    .where(eq(topic.id, id))
    .limit(1)
    .then(res => res[0] || null);

  if (!existingTopic) {
    throw new Error("Topic not found");
  }

  const canModify = await canModifyContent(
    existingTopic.ownerId || "",
    userId,
    userRole
  );

  if (!canModify) {
    throw new Error("You don't have permission to modify this topic");
  }

  await db
    .update(topic)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(topic.id, id));

  revalidatePath("/admin");
  revalidatePath("/regular");
}

export async function deleteTopic(
  id: string,
  userId: string,
  userRole: UserRole
): Promise<void> {
  const existingTopic = await db
    .select()
    .from(topic)
    .where(eq(topic.id, id))
    .limit(1)
    .then(res => res[0] || null);

  if (!existingTopic) {
    throw new Error("Topic not found");
  }

  const canModify = await canModifyContent(
    existingTopic.ownerId || "",
    userId,
    userRole
  );

  if (!canModify) {
    throw new Error("You don't have permission to delete this topic");
  }

  await db.delete(topic).where(eq(topic.id, id));
  revalidatePath("/admin");
  revalidatePath("/regular");
}

// ==========================================
// BACKWARD-COMPATIBLE WRAPPER FUNCTIONS
// ==========================================
// These wrappers get user info from Clerk session for client components

export async function deleteLevelWithSession(id: string): Promise<void> {
  const { auth } = await import("@clerk/nextjs/server");
  const { userId: clerkId } = await auth();
  
  if (!clerkId) {
    throw new Error("Not authenticated");
  }
  
  const { getUserByClerkId } = await import("./auth");
  const user = await getUserByClerkId(clerkId);
  
  if (!user) {
    throw new Error("User not found");
  }
  
  return deleteLevel(id, user.id, user.role);
}

export async function deleteSubjectWithSession(id: string): Promise<void> {
  const { auth } = await import("@clerk/nextjs/server");
  const { userId: clerkId } = await auth();
  
  if (!clerkId) {
    throw new Error("Not authenticated");
  }
  
  const { getUserByClerkId } = await import("./auth");
  const user = await getUserByClerkId(clerkId);
  
  if (!user) {
    throw new Error("User not found");
  }
  
  return deleteSubject(id, user.id, user.role);
}

export async function deleteTopicWithSession(id: string): Promise<void> {
  const { auth } = await import("@clerk/nextjs/server");
  const { userId: clerkId } = await auth();
  
  if (!clerkId) {
    throw new Error("Not authenticated");
  }
  
  const { getUserByClerkId } = await import("./auth");
  const user = await getUserByClerkId(clerkId);
  
  if (!user) {
    throw new Error("User not found");
  }
  
  return deleteTopic(id, user.id, user.role);
}

// Update functions with session
export async function updateLevelWithSession(input: UpdateLevelInput): Promise<void> {
  const { auth } = await import("@clerk/nextjs/server");
  const { userId: clerkId } = await auth();
  
  if (!clerkId) {
    throw new Error("Not authenticated");
  }
  
  const { getUserByClerkId } = await import("./auth");
  const user = await getUserByClerkId(clerkId);
  
  if (!user) {
    throw new Error("User not found");
  }
  
  return updateLevel(input, user.id, user.role);
}

export async function updateSubjectWithSession(input: UpdateSubjectInput): Promise<void> {
  const { auth } = await import("@clerk/nextjs/server");
  const { userId: clerkId } = await auth();
  
  if (!clerkId) {
    throw new Error("Not authenticated");
  }
  
  const { getUserByClerkId } = await import("./auth");
  const user = await getUserByClerkId(clerkId);
  
  if (!user) {
    throw new Error("User not found");
  }
  
  return updateSubject(input, user.id, user.role);
}

export async function updateTopicWithSession(input: UpdateTopicInput): Promise<void> {
  const { auth } = await import("@clerk/nextjs/server");
  const { userId: clerkId } = await auth();
  
  if (!clerkId) {
    throw new Error("Not authenticated");
  }
  
  const { getUserByClerkId } = await import("./auth");
  const user = await getUserByClerkId(clerkId);
  
  if (!user) {
    throw new Error("User not found");
  }
  
  return updateTopic(input, user.id, user.role);
}

// ==========================================
// LEGACY EXPORTS (for backward compatibility)
// ==========================================

// These functions maintain backward compatibility but should be updated
export async function getLevels(): Promise<LevelWithSubjects[]> {
  const levelsData = await db
    .select()
    .from(level)
    .orderBy(asc(level.order));
  
  const levelIds = levelsData.map(l => l.id);
  const subjectsData = levelIds.length > 0
    ? await db
        .select()
        .from(subject)
        .where(inArray(subject.levelId, levelIds))
        .orderBy(asc(subject.name))
    : [];
  
  const subjectIds = subjectsData.map(s => s.id);
  const topicsData = subjectIds.length > 0
    ? await db
        .select()
        .from(topic)
        .where(inArray(topic.subjectId, subjectIds))
        .orderBy(asc(topic.order))
    : [];
  
  const levels = levelsData.map(l => ({
    ...l,
    subjects: subjectsData
      .filter(s => s.levelId === l.id)
      .map(s => ({
        ...s,
        topics: topicsData.filter(t => t.subjectId === s.id),
      })),
  }));
  
  return levels as unknown as LevelWithSubjects[];
}

export async function getLevelsFullHierarchy(options?: { publishedOnly?: boolean }): Promise<LevelWithFullHierarchy[]> {
  const levelsData = await db
    .select()
    .from(level)
    .orderBy(asc(level.order));

  const levelIds = levelsData.map(l => l.id);
  const subjectsData = levelIds.length > 0
    ? await db
        .select()
        .from(subject)
        .where(inArray(subject.levelId, levelIds))
        .orderBy(asc(subject.name))
    : [];

  const subjectIds = subjectsData.map(s => s.id);
  const topicsData = subjectIds.length > 0
    ? await db
        .select()
        .from(topic)
        .where(inArray(topic.subjectId, subjectIds))
        .orderBy(asc(topic.order))
    : [];

  const topicIds = topicsData.map(t => t.id);
  const resourcesData = topicIds.length > 0
    ? await db
        .select()
        .from(resource)
        .where(
          options?.publishedOnly
            ? and(inArray(resource.topicId, topicIds), eq(resource.status, "published"))
            : inArray(resource.topicId, topicIds)
        )
        .orderBy(desc(resource.createdAt))
    : [];
  
  const levels = levelsData.map(l => ({
    ...l,
    subjects: subjectsData
      .filter(s => s.levelId === l.id)
      .map(s => ({
        ...s,
        topics: topicsData
          .filter(t => t.subjectId === s.id)
          .map(t => ({
            ...t,
            resources: resourcesData.filter(r => r.topicId === t.id),
          })),
      })),
  }));
  
  return levels as unknown as LevelWithFullHierarchy[];
}

export async function getLevelById(id: string): Promise<LevelWithSubjects | null> {
  const levelData = await db
    .select()
    .from(level)
    .where(eq(level.id, id))
    .limit(1)
    .then(res => res[0] || null);
  
  if (!levelData) return null;
  
  const subjectsData = await db
    .select()
    .from(subject)
    .where(eq(subject.levelId, id))
    .orderBy(asc(subject.name));
  
  const subjectIds = subjectsData.map(s => s.id);
  const topicsData = subjectIds.length > 0
    ? await db
        .select()
        .from(topic)
        .where(inArray(topic.subjectId, subjectIds))
        .orderBy(asc(topic.order))
    : [];
  
  const result = {
    ...levelData,
    subjects: subjectsData.map(s => ({
      ...s,
      topics: topicsData.filter(t => t.subjectId === s.id),
    })),
  };
  
  return result as unknown as LevelWithSubjects;
}

// Keep other existing exports for backward compatibility
export async function getSubjects(): Promise<SubjectWithTopicsAndLevel[]> {
  const subjectsData = await db
    .select()
    .from(subject)
    .orderBy(asc(subject.name));
  
  const subjectIds = subjectsData.map(s => s.id);
  const levelIds = [...new Set(subjectsData.map(s => s.levelId).filter(Boolean))];
  
  const [topicsData, levelsData] = await Promise.all([
    subjectIds.length > 0
      ? db.select().from(topic).where(inArray(topic.subjectId, subjectIds)).orderBy(asc(topic.order))
      : Promise.resolve([]),
    levelIds.length > 0
      ? db.select().from(level).where(inArray(level.id, levelIds))
      : Promise.resolve([]),
  ]);
  
  const subjects = subjectsData.map(s => ({
    ...s,
    topics: topicsData.filter(t => t.subjectId === s.id),
    level: levelsData.find(l => l.id === s.levelId),
  }));
  
  return subjects as SubjectWithTopicsAndLevel[];
}

export async function getSubjectById(id: string): Promise<SubjectWithTopicsAndLevel | null> {
  const subjectData = await db
    .select()
    .from(subject)
    .where(eq(subject.id, id))
    .limit(1)
    .then(res => res[0] || null);
  
  if (!subjectData) return null;
  
  const [topicsData, levelData] = await Promise.all([
    db.select().from(topic).where(eq(topic.subjectId, id)).orderBy(asc(topic.order)),
    subjectData.levelId 
      ? db.select().from(level).where(eq(level.id, subjectData.levelId)).limit(1).then(res => res[0] || null)
      : Promise.resolve(null),
  ]);
  
  return {
    ...subjectData,
    topics: topicsData,
    level: levelData,
  } as SubjectWithTopicsAndLevel;
}

export async function getTopics(): Promise<TopicWithResourcesAndSubject[]> {
  const topicsData = await db
    .select()
    .from(topic)
    .orderBy(asc(topic.order));
  
  const topicIds = topicsData.map(t => t.id);
  const subjectIds = [...new Set(topicsData.map(t => t.subjectId).filter(Boolean))];
  
  const [resourcesData, subjectsData] = await Promise.all([
    topicIds.length > 0
      ? db.select().from(resource).where(inArray(resource.topicId, topicIds)).orderBy(desc(resource.createdAt))
      : Promise.resolve([]),
    subjectIds.length > 0
      ? db.select().from(subject).where(inArray(subject.id, subjectIds))
      : Promise.resolve([]),
  ]);
  
  const topics = topicsData.map(t => ({
    ...t,
    resources: resourcesData.filter(r => r.topicId === t.id),
    subject: subjectsData.find(s => s.id === t.subjectId),
  }));
  
  return topics as unknown as TopicWithResourcesAndSubject[];
}

export async function getTopicById(id: string): Promise<TopicWithResourcesAndSubject | null> {
  const topicData = await db
    .select()
    .from(topic)
    .where(eq(topic.id, id))
    .limit(1)
    .then(res => res[0] || null);
  
  if (!topicData) return null;
  
  const [resourcesData, subjectData] = await Promise.all([
    db.select().from(resource).where(eq(resource.topicId, id)).orderBy(desc(resource.createdAt)),
    topicData.subjectId
      ? db.select().from(subject).where(eq(subject.id, topicData.subjectId)).limit(1).then(res => res[0] || null)
      : Promise.resolve(null),
  ]);
  
  return {
    ...topicData,
    resources: resourcesData,
    subject: subjectData,
  } as unknown as TopicWithResourcesAndSubject;
}

export async function getResources(): Promise<ResourceWithRelations[]> {
  const resourcesData = await db
    .select()
    .from(resource)
    .orderBy(desc(resource.createdAt));
  
  const subjectIds = [...new Set(resourcesData.map(r => r.subjectId).filter(Boolean))];
  const topicIds = [...new Set(resourcesData.map(r => r.topicId).filter(Boolean))];
  
  const [subjectsData, topicsData] = await Promise.all([
    subjectIds.length > 0
      ? db.select().from(subject).where(inArray(subject.id, subjectIds))
      : Promise.resolve([]),
    topicIds.length > 0
      ? db.select().from(topic).where(inArray(topic.id, topicIds))
      : Promise.resolve([]),
  ]);
  
  const resources = resourcesData.map(r => ({
    ...r,
    subject: subjectsData.find(s => s.id === r.subjectId),
    topic: topicsData.find(t => t.id === r.topicId),
  }));
  
  return resources as unknown as ResourceWithRelations[];
}

export async function getResourcesForUser(
  userId: string,
  userRole: UserRole
): Promise<Resource[]> {
  const adminIds = userRole === "regular" ? await getRegularAdminIds(userId) : [];

  // Build conditions based on role and ownership rules
  const conditions = [];

  if (userRole === "super_admin") {
    // Super-admin sees all resources
    const resources = await db
      .select()
      .from(resource)
      .orderBy(desc(resource.createdAt));
    return resources;
  }

  if (userRole === "admin") {
    // Admin sees: own content + super-admin content + public
    conditions.push(
      eq(resource.ownerId, userId),
      eq(resource.ownerRole, "super_admin"),
      eq(resource.visibility, "public")
    );
  } else {
    // Regular sees: own content + super-admin content + public + all admins' content
    conditions.push(
      eq(resource.ownerId, userId),
      eq(resource.ownerRole, "super_admin"),
      eq(resource.visibility, "public")
    );
    
    // Add conditions for each admin the regular belongs to
    adminIds.forEach(adminId => {
      conditions.push(eq(resource.ownerId, adminId));
    });
  }

  const resources = await db
    .select()
    .from(resource)
    .where(or(...conditions))
    .orderBy(desc(resource.createdAt));

  return resources;
}

export async function getResourceById(id: string): Promise<ResourceWithRelations | null> {
  const resourceData = await db
    .select()
    .from(resource)
    .where(eq(resource.id, id))
    .limit(1)
    .then(res => res[0] || null);
  
  if (!resourceData) return null;
  
  const [subjectData, topicData] = await Promise.all([
    resourceData.subjectId
      ? db.select().from(subject).where(eq(subject.id, resourceData.subjectId)).limit(1).then(res => res[0] || null)
      : Promise.resolve(null),
    resourceData.topicId
      ? db.select().from(topic).where(eq(topic.id, resourceData.topicId)).limit(1).then(res => res[0] || null)
      : Promise.resolve(null),
  ]);
  
  return {
    ...resourceData,
    subject: subjectData,
    topic: topicData,
  } as unknown as ResourceWithRelations;
}

export async function createResource(input: CreateResourceInput): Promise<void> {
  const [newResource] = await db.insert(resource).values({
    subjectId: input.subjectId,
    topicId: input.topicId,
    title: input.title,
    description: input.description,
    type: input.type,
    url: input.url,
    thumbnailUrl: input.thumbnailUrl || null,
    uploadthingKey: input.uploadthingKey || null,
    metadata: input.metadata || null,
    ownerId: input.ownerId,
    ownerRole: input.ownerRole,
    visibility: input.visibility,
    status: input.status ?? "published",
    isLocked: input.isLocked ?? false,
    unlockFee: input.unlockFee ?? 0,
    isActive: true,
    createdAt: new Date(),
  }).returning();
  
  // Sync unlock fee if price is set and resource is locked
  if (input.isLocked && input.unlockFee && input.unlockFee > 0 && newResource) {
    const { syncUnlockFeeForResource } = await import("@/lib/actions/credits");
    await syncUnlockFeeForResource(newResource.id);
  }

  if (newResource) {
    await logAudit(input.ownerId, "resource.created", "resource", newResource.id, {
      title: input.title,
      type: input.type,
      status: input.status ?? "published",
      visibility: input.visibility,
    });
  }

  revalidatePath("/admin");
  revalidatePath("/regular");
}

export async function updateResource(input: UpdateResourceInput): Promise<void> {
  const { id, ...data } = input;
  
  // Get current resource data to check if unlockFee changed
  const currentResource = await db
    .select()
    .from(resource)
    .where(eq(resource.id, id))
    .limit(1)
    .then(res => res[0] || null);
  
  await db
    .update(resource)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(resource.id, id));
  
  // Sync unlock fee if price changed or lock status changed
  if (data.unlockFee !== undefined || data.isLocked !== undefined) {
    const { syncUnlockFeeForResource } = await import("@/lib/actions/credits");
    await syncUnlockFeeForResource(id);
  }
  
  revalidatePath("/admin");
  revalidatePath("/regular");
}

// New function to update resource lock status and fee
export async function updateResourceLockStatus(
  resourceId: string,
  isLocked: boolean,
  unlockFee: number,
  userId: string,
  userRole: UserRole
): Promise<void> {
  // Check ownership
  const existingResource = await db
    .select()
    .from(resource)
    .where(eq(resource.id, resourceId))
    .limit(1)
    .then(res => res[0] || null);

  if (!existingResource) {
    throw new Error("Resource not found");
  }

  const canModify = await canModifyContent(
    existingResource.ownerId,
    userId,
    userRole
  );

  if (!canModify) {
    throw new Error("You don't have permission to modify this resource");
  }

  await db
    .update(resource)
    .set({
      isLocked,
      unlockFee,
      updatedAt: new Date(),
    })
    .where(eq(resource.id, resourceId));
  
  // Sync unlock fee to ensure single source of truth
  const { syncUnlockFeeForResource } = await import("@/lib/actions/credits");
  await syncUnlockFeeForResource(resourceId);

  revalidatePath("/admin");
  revalidatePath("/regular");
}

export async function deleteResource(id: string): Promise<void> {
  // Fetch the uploadthing key before deletion so we can clean up the file
  const existing = await db
    .select({ uploadthingKey: resource.uploadthingKey })
    .from(resource)
    .where(eq(resource.id, id))
    .limit(1)
    .then((rows) => rows[0] || null);

  await db.delete(resource).where(eq(resource.id, id));

  // Delete the file from UploadThing storage (best-effort — don't fail the delete if this errors)
  if (existing?.uploadthingKey) {
    try {
      const { UTApi } = await import("uploadthing/server");
      const utapi = new UTApi();
      await utapi.deleteFiles(existing.uploadthingKey);
    } catch (err) {
      console.error("Failed to delete UploadThing file:", err);
    }
  }

  // Audit log (actor unknown at server action level — caller can pass it if needed)
  await logAudit(null, "resource.deleted", "resource", id);

  revalidatePath("/admin");
}

export async function bulkDeleteResources(ids: string[]): Promise<{ deleted: number; errors: string[] }> {
  if (ids.length === 0) return { deleted: 0, errors: [] };

  let deleted = 0;
  const errors: string[] = [];

  for (const id of ids) {
    try {
      await deleteResource(id);
      deleted++;
    } catch (err) {
      errors.push(id);
      console.error(`Failed to delete resource ${id}:`, err);
    }
  }

  return { deleted, errors };
}

// ==========================================
// REGULAR USER MANAGEMENT (My Regulars)
// ==========================================

export interface MyLearnerWithDetails {
  id: string;
  adminId: string;
  regularId: string;
  regularEmail: string;
  metadata: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  regular: User | null;
}

export async function getMyLearners(adminId: string): Promise<MyLearnerWithDetails[]> {
  const regularsData = await db
    .select()
    .from(adminRegulars)
    .where(eq(adminRegulars.adminId, adminId))
    .orderBy(desc(adminRegulars.createdAt));
  
  // Fetch regular users separately
  const regularIds = regularsData.map(r => r.regularId);
  const usersData = regularIds.length > 0
    ? await db.select().from(user).where(inArray(user.id, regularIds))
    : [];
  
  const regulars = regularsData.map(r => ({
    ...r,
    regular: usersData.find(u => u.id === r.regularId) || null,
  }));
  
  return regulars as MyLearnerWithDetails[];
}

export async function addMyLearner(
  adminId: string,
  regularEmail: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const { getUserByEmail } = await import("./auth");
  const regular = await getUserByEmail(regularEmail);
  
  if (!regular) {
    throw new Error("Regular user not found. Please ensure the user has registered with this email.");
  }

  if (regular.role !== "regular") {
    throw new Error("The specified user is not a regular user.");
  }

  const existing = await db
    .select()
    .from(adminRegulars)
    .where(and(
      eq(adminRegulars.adminId, adminId),
      eq(adminRegulars.regularId, regular.id)
    ))
    .limit(1)
    .then(res => res[0] || null);

  if (existing) {
    throw new Error("This regular user is already in your list.");
  }

  await db.insert(adminRegulars).values({
    adminId,
    regularId: regular.id,
    regularEmail,
    metadata: metadata || null,
    isActive: true,
  });

  revalidatePath("/admin/regulars");
}

export async function removeMyLearner(adminId: string, regularId: string): Promise<void> {
  await db
    .delete(adminRegulars)
    .where(
      and(
        eq(adminRegulars.adminId, adminId),
        eq(adminRegulars.regularId, regularId)
      )
    );

  revalidatePath("/admin/regulars");
}

export interface BulkAddResult {
  successfullyAdded: { email: string; userId: string }[];
  alreadyExists: string[];
  invalidEmails: string[];
  notFound: string[];
  notRegularRole: string[];
  totalProcessed: number;
}

export async function bulkAddMyLearners(
  adminId: string,
  emails: string[],
  metadata?: Record<string, unknown>
): Promise<BulkAddResult> {
  const { getUserByEmail } = await import("./auth");
  
  // Clean and deduplicate emails
  const uniqueEmails = [...new Set(emails.map(e => e.trim().toLowerCase()).filter(e => e.length > 0))];
  
  const result: BulkAddResult = {
    successfullyAdded: [],
    alreadyExists: [],
    invalidEmails: [],
    notFound: [],
    notRegularRole: [],
    totalProcessed: uniqueEmails.length,
  };
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const validEmails: string[] = [];
  
  for (const email of uniqueEmails) {
    if (!emailRegex.test(email)) {
      result.invalidEmails.push(email);
    } else {
      validEmails.push(email);
    }
  }
  
  // Get existing regulars for this admin to check for duplicates
  const existingRegulars = await db
    .select()
    .from(adminRegulars)
    .where(eq(adminRegulars.adminId, adminId));
  
  const existingRegularIds = new Set(existingRegulars.map(r => r.regularId));
  
  // Process each valid email
  for (const email of validEmails) {
    try {
      const regular = await getUserByEmail(email);
      
      if (!regular) {
        result.notFound.push(email);
        continue;
      }
      
      if (regular.role !== "regular") {
        result.notRegularRole.push(email);
        continue;
      }
      
      if (existingRegularIds.has(regular.id)) {
        result.alreadyExists.push(email);
        continue;
      }
      
      // Add the regular
      await db.insert(adminRegulars).values({
        adminId,
        regularId: regular.id,
        regularEmail: email,
        metadata: metadata || null,
        isActive: true,
      });
      
      result.successfullyAdded.push({ email, userId: regular.id });
      existingRegularIds.add(regular.id);
    } catch (error) {
      console.error(`Error processing email ${email}:`, error);
      result.notFound.push(email);
    }
  }
  
  revalidatePath("/admin/regulars");
  return result;
}

export interface BulkRemoveResult {
  deletedCount: number;
  failedCount: number;
}

export async function bulkRemoveMyLearners(
  adminId: string,
  regularIds: string[]
): Promise<BulkRemoveResult> {
  // Use a transaction for atomic bulk delete
  const result = await db.transaction(async (tx) => {
    let deletedCount = 0;
    
    for (const regularId of regularIds) {
      const deleteResult = await tx
        .delete(adminRegulars)
        .where(
          and(
            eq(adminRegulars.adminId, adminId),
            eq(adminRegulars.regularId, regularId)
          )
        )
        .returning({ id: adminRegulars.id });
      
      if (deleteResult.length > 0) {
        deletedCount++;
      }
    }
    
    return { deletedCount };
  });
  
  revalidatePath("/admin/regulars");
  
  return {
    deletedCount: result.deletedCount,
    failedCount: regularIds.length - result.deletedCount,
  };
}

// ==========================================
// SUPER ADMIN SYSTEM MANAGEMENT
// ==========================================

export interface PaginatedLearners {
  learners: MyLearnerWithDetails[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export async function getMyLearnersPaginated(
  adminId: string,
  page: number = 1,
  pageSize: number = 10,
  search?: string
): Promise<PaginatedLearners> {
  const offset = (page - 1) * pageSize;

  const baseConditions = [eq(adminRegulars.adminId, adminId)];
  if (search) {
    baseConditions.push(ilike(adminRegulars.regularEmail, `%${search}%`));
  }
  const whereClause = and(...baseConditions);

  const [totalResult, regularsData] = await Promise.all([
    db.select({ count: count() }).from(adminRegulars).where(whereClause),
    db
      .select()
      .from(adminRegulars)
      .where(whereClause)
      .orderBy(desc(adminRegulars.createdAt))
      .limit(pageSize)
      .offset(offset),
  ]);

  const totalCount = totalResult[0]?.count ?? 0;

  const regularIds = regularsData.map((r) => r.regularId);
  const usersData =
    regularIds.length > 0
      ? await db.select().from(user).where(inArray(user.id, regularIds))
      : [];

  const learners = regularsData.map((r) => ({
    ...r,
    regular: usersData.find((u) => u.id === r.regularId) || null,
  })) as MyLearnerWithDetails[];

  return {
    learners,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    currentPage: page,
  };
}

export async function getAllUsers(): Promise<User[]> {
  const users = await db
    .select()
    .from(user)
    .orderBy(desc(user.createdAt));
  return users;
}

export interface SystemStats {
  totalUsers: number;
  totalRegulars: number;
  totalAdmins: number;
  totalSuperAdmins: number;
  totalLevels: number;
  totalSubjects: number;
  totalTopics: number;
  totalResources: number;
}

export async function getSystemStats(): Promise<SystemStats> {
  const [
    users,
    levels,
    subjects,
    topics,
    resources,
  ] = await Promise.all([
    db.select().from(user),
    db.select().from(level),
    db.select().from(subject),
    db.select().from(topic),
    db.select().from(resource),
  ]);

  return {
    totalUsers: users.length,
    totalRegulars: users.filter(u => u.role === "regular").length,
    totalAdmins: users.filter(u => u.role === "admin").length,
    totalSuperAdmins: users.filter(u => u.role === "super_admin").length,
    totalLevels: levels.length,
    totalSubjects: subjects.length,
    totalTopics: topics.length,
    totalResources: resources.length,
  };
}
