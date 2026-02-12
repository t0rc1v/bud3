"use server";

import { db } from "@/lib/db";
import { level, subject, topic, resource, adminRegulars, user } from "@/lib/db/schema";
import { eq, and, desc, asc, inArray, or, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
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
 * Get the admin IDs for a regular user (supports multiple admins)
 */
export async function getRegularAdminIds(regularId: string): Promise<string[]> {
  const adminRegularsList = await db.query.adminRegulars.findMany({
    where: eq(adminRegulars.regularId, regularId),
    with: {
      admin: true,
    },
  });
  return adminRegularsList.map(ar => ar.adminId);
}

/**
 * Build visibility filter for content queries based on ownership rules:
 * - Super-admin content: visible to all (view-only for non-owners)
 * - Admin content: visible to the admin + their regulars only (not other admins)
 * - Regular content: visible to themselves only
 * - Regular users with multiple admins: can view content from ALL their admins
 * 
 * Management rule: users can only manage (CRUD) their own content regardless of role
 */
export async function buildContentVisibilityFilter(
  userId: string,
  userRole: UserRole,
  adminIds: string[] = []
) {
  if (userRole === "super_admin") {
    // Super-admin sees all content (can manage all)
    return undefined;
  }

  if (userRole === "admin") {
    // Admin sees:
    // 1. Their own content (can manage)
    // 2. Super-admin content (view-only)
    // 3. Public visibility content
    return or(
      eq(level.ownerId, userId),
      eq(level.ownerRole, "super_admin"),
      eq(level.visibility, "public")
    );
  }

  // Regular user sees:
  // 1. Their own content (can manage)
  // 2. Content from ALL their admins (view-only)
  // 3. Super-admin content (view-only)
  // 4. Public visibility content
  const conditions = [
    eq(level.ownerId, userId),
    eq(level.ownerRole, "super_admin"),
    eq(level.visibility, "public"),
  ];

  // Add conditions for each admin the regular user belongs to
  if (adminIds.length > 0) {
    adminIds.forEach(adminId => {
      conditions.push(eq(level.ownerId, adminId));
    });
  }

  return or(...conditions);
}

/**
 * Check if a user can access specific content based on ownership rules:
 * - Super-admin content: visible to all (view-only for non-owners)
 * - Admin content: visible to the admin + their regulars only
 * - Regular content: visible to themselves only
 * - Regular users with multiple admins: can view content from ALL their admins
 */
export async function canAccessContent(
  contentOwnerId: string,
  contentOwnerRole: UserRole,
  contentVisibility: string,
  userId: string,
  userRole: UserRole
): Promise<boolean> {
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
      const adminIds = await getRegularAdminIds(userId);
      return adminIds.includes(contentOwnerId);
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
      if (userRole === "regular") {
        const adminIds = await getRegularAdminIds(userId);
        return contentOwnerId === userId || adminIds.includes(contentOwnerId);
      }
      return userRole === "super_admin" as UserRole;
    case "regular_only":
      if (userRole === "regular") {
        const adminIds = await getRegularAdminIds(userId);
        return contentOwnerId === userId || adminIds.includes(contentOwnerId);
      }
      return false;
    default:
      // Default: if ownerRole is not set, only allow if user is the owner
      return contentOwnerId === userId;
  }
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
): Promise<LevelWithFullHierarchy[]> {
  const adminIds = userRole === "regular" ? await getRegularAdminIds(userId) : [];
  
  const visibilityFilter = await buildContentVisibilityFilter(userId, userRole, adminIds);
  
  const levels = await db.query.level.findMany({
    where: visibilityFilter || undefined,
    orderBy: [asc(level.order)],
    with: {
      subjects: {
        with: {
          topics: {
            with: {
              resources: true,
            },
          },
        },
      },
    },
  });
  
  return levels as unknown as LevelWithFullHierarchy[];
}

export async function getLevelByIdWithAccessCheck(
  id: string,
  userId: string,
  userRole: UserRole
): Promise<LevelWithSubjects | null> {
  const levelData = await db.query.level.findFirst({
    where: eq(level.id, id),
    with: {
      subjects: true,
    },
  });

  if (!levelData) return null;

  const hasAccess = await canAccessContent(
    levelData.ownerId || "",
    levelData.ownerRole,
    levelData.visibility,
    userId,
    userRole
  );

  return hasAccess ? (levelData as unknown as LevelWithSubjects) : null;
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
  const existingLevel = await db.query.level.findFirst({
    where: eq(level.id, id),
  });

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
  const existingLevel = await db.query.level.findFirst({
    where: eq(level.id, id),
  });

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

  // First, remove level references from admin_regulars to avoid FK constraint
  await db.update(adminRegulars)
    .set({ levelId: null })
    .where(eq(adminRegulars.levelId, id));

  // Now delete the level (cascade will handle subjects, topics, resources)
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
    const subjects = await db.query.subject.findMany({
      orderBy: [asc(subject.name)],
      with: {
        topics: {
          with: {
            resources: true,
          },
        },
      },
    });
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

  const subjects = await db.query.subject.findMany({
    where: or(...conditions),
    orderBy: [asc(subject.name)],
    with: {
      topics: {
        with: {
          resources: true,
        },
      },
    },
  });

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

  const existingSubject = await db.query.subject.findFirst({
    where: eq(subject.id, id),
  });

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
  const existingSubject = await db.query.subject.findFirst({
    where: eq(subject.id, id),
  });

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
    const topics = await db.query.topic.findMany({
      orderBy: [asc(topic.order)],
      with: {
        resources: true,
      },
    });
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

  const topics = await db.query.topic.findMany({
    where: or(...conditions),
    orderBy: [asc(topic.order)],
    with: {
      resources: true,
    },
  });

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

  const existingTopic = await db.query.topic.findFirst({
    where: eq(topic.id, id),
  });

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
  const existingTopic = await db.query.topic.findFirst({
    where: eq(topic.id, id),
  });

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
  const levels = await db.query.level.findMany({
    orderBy: [asc(level.order)],
    with: {
      subjects: {
        with: {
          topics: true,
        },
      },
    },
  });
  return levels as unknown as LevelWithSubjects[];
}

export async function getLevelsFullHierarchy(): Promise<LevelWithFullHierarchy[]> {
  const levels = await db.query.level.findMany({
    orderBy: [asc(level.order)],
    with: {
      subjects: {
        with: {
          topics: {
            with: {
              resources: true,
            },
          },
        },
      },
    },
  });
  return levels as unknown as LevelWithFullHierarchy[];
}

export async function getLevelById(id: string): Promise<LevelWithSubjects | null> {
  const result = await db.query.level.findFirst({
    where: eq(level.id, id),
    with: {
      subjects: {
        with: {
          topics: true,
        },
      },
    },
  });
  return (result as unknown as LevelWithSubjects) ?? null;
}

// Keep other existing exports for backward compatibility
export async function getSubjects(): Promise<SubjectWithTopicsAndLevel[]> {
  const subjects = await db.query.subject.findMany({
    orderBy: [asc(subject.name)],
    with: {
      topics: true,
      level: true,
    },
  });
  return subjects;
}

export async function getSubjectById(id: string): Promise<SubjectWithTopicsAndLevel | null> {
  const result = await db.query.subject.findFirst({
    where: eq(subject.id, id),
    with: {
      topics: true,
      level: true,
    },
  });
  return result ?? null;
}

export async function getTopics(): Promise<TopicWithResourcesAndSubject[]> {
  const topics = await db.query.topic.findMany({
    orderBy: [asc(topic.order)],
    with: {
      resources: true,
      subject: true,
    },
  });
  return topics as TopicWithResourcesAndSubject[];
}

export async function getTopicById(id: string): Promise<TopicWithResourcesAndSubject | null> {
  const result = await db.query.topic.findFirst({
    where: eq(topic.id, id),
    with: {
      resources: true,
      subject: true,
    },
  });
  return result ?? null;
}

export async function getResources(): Promise<ResourceWithRelations[]> {
  const resources = await db.query.resource.findMany({
    orderBy: [desc(resource.createdAt)],
    with: {
      subject: true,
      topic: true,
    },
  });
  return resources;
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
    const resources = await db.query.resource.findMany({
      orderBy: [desc(resource.createdAt)],
    });
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

  const resources = await db.query.resource.findMany({
    where: or(...conditions),
    orderBy: [desc(resource.createdAt)],
  });

  return resources;
}

export async function getResourceById(id: string): Promise<ResourceWithRelations | null> {
  const result = await db.query.resource.findFirst({
    where: eq(resource.id, id),
    with: {
      subject: true,
      topic: true,
    },
  });
  return result ?? null;
}

export async function createResource(input: CreateResourceInput): Promise<void> {
  await db.insert(resource).values({
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
    isLocked: input.isLocked ?? false,
    unlockFee: input.unlockFee ?? 0,
    isActive: true,
    createdAt: new Date(),
  });
  revalidatePath("/admin");
  revalidatePath("/regular");
}

export async function updateResource(input: UpdateResourceInput): Promise<void> {
  const { id, ...data } = input;
  await db
    .update(resource)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(resource.id, id));
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
  const existingResource = await db.query.resource.findFirst({
    where: eq(resource.id, resourceId),
  });

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

  revalidatePath("/admin");
  revalidatePath("/regular");
}

export async function deleteResource(id: string): Promise<void> {
  await db.delete(resource).where(eq(resource.id, id));
  revalidatePath("/admin");
}

// ==========================================
// REGULAR USER MANAGEMENT (My Regulars)
// ==========================================

export interface MyLearnerWithDetails {
  id: string;
  adminId: string;
  regularId: string;
  regularEmail: string;
  levelId: string;
  metadata: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  regular: User | null;
  level: typeof level.$inferSelect;
}

export async function getMyLearners(adminId: string): Promise<MyLearnerWithDetails[]> {
  const regulars = await db.query.adminRegulars.findMany({
    where: eq(adminRegulars.adminId, adminId),
    with: {
      regular: true,
      level: true,
    },
    orderBy: [desc(adminRegulars.createdAt)],
  });
  return regulars as MyLearnerWithDetails[];
}

export async function addMyLearner(
  adminId: string,
  regularEmail: string,
  levelId: string,
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

  const existing = await db.query.adminRegulars.findFirst({
    where: and(
      eq(adminRegulars.adminId, adminId),
      eq(adminRegulars.regularId, regular.id)
    ),
  });

  if (existing) {
    throw new Error("This regular user is already in your list.");
  }

  await db.insert(adminRegulars).values({
    adminId,
    regularId: regular.id,
    regularEmail,
    levelId,
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

// ==========================================
// SUPER ADMIN SYSTEM MANAGEMENT
// ==========================================

export async function getAllUsers(): Promise<User[]> {
  const users = await db.query.user.findMany({
    orderBy: [desc(user.createdAt)],
  });
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
    db.query.user.findMany(),
    db.query.level.findMany(),
    db.query.subject.findMany(),
    db.query.topic.findMany(),
    db.query.resource.findMany(),
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
