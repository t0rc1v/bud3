import { type InferSelectModel } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

export type Level = InferSelectModel<typeof schema.level>;
export type Subject = InferSelectModel<typeof schema.subject>;
export type Topic = InferSelectModel<typeof schema.topic>;
export type Resource = InferSelectModel<typeof schema.resource>;
export type User = InferSelectModel<typeof schema.user>;

export interface TopicWithResources extends Topic {
  resources: Resource[];
}

export interface TopicWithResourcesAndSubject extends Topic {
  resources: Resource[];
  subject: Subject | null;
}

export interface SubjectWithTopics extends Subject {
  topics: TopicWithResources[];
}

export interface SubjectWithTopicsAndLevel extends Subject {
  topics: Topic[];
  level: Level | null;
}

export interface LevelWithSubjects extends Level {
  subjects: SubjectWithTopics[];
}

export interface LevelWithFullHierarchy extends Level {
  subjects: SubjectWithTopics[];
}

// Extended types that include unlock status for the current user
export interface ResourceWithUnlockStatus extends Resource {
  isUnlocked: boolean;
}

export interface TopicWithResourcesAndUnlockStatus extends Topic {
  resources: ResourceWithUnlockStatus[];
}

export interface SubjectWithTopicsAndUnlockStatus extends Subject {
  topics: TopicWithResourcesAndUnlockStatus[];
}

export interface LevelWithFullHierarchyAndUnlockStatus extends Level {
  subjects: SubjectWithTopicsAndUnlockStatus[];
}

export interface ResourceWithRelations extends Resource {
  subject: Subject | null;
  topic: Topic | null;
}

export type ResourceType = "notes" | "video" | "audio" | "image";
export type UserRole = "regular" | "admin" | "super_admin";
export type UserVerificationStatus = "pending" | "approved" | "rejected";
export type ResourceVisibility = "public" | "admin_only" | "admin_and_regulars" | "regular_only";
export type ContentVisibility = "public" | "admin_only" | "admin_and_regulars" | "regular_only";

export interface CreateLevelInput {
  levelNumber: number;
  title: string;
  order: number;
  color: string;
  // Ownership fields
  ownerId: string;
  ownerRole: UserRole;
  visibility: ContentVisibility;
}

export interface UpdateLevelInput extends Partial<CreateLevelInput> {
  id: string;
}

export interface CreateSubjectInput {
  levelId: string;
  name: string;
  icon: string;
  color: string;
  // Ownership fields
  ownerId: string;
  ownerRole: UserRole;
  visibility: ContentVisibility;
}

export interface UpdateSubjectInput extends Partial<CreateSubjectInput> {
  id: string;
}

export interface CreateTopicInput {
  subjectId: string;
  title: string;
  order: number;
  // Ownership fields
  ownerId: string;
  ownerRole: UserRole;
  visibility: ContentVisibility;
}

export interface UpdateTopicInput extends Partial<CreateTopicInput> {
  id: string;
}

export interface CreateResourceInput {
  subjectId: string;
  topicId: string;
  title: string;
  description: string;
  type: ResourceType;
  url: string;
  thumbnailUrl?: string;
  uploadthingKey?: string;
  metadata?: Record<string, unknown>;
  // Ownership and visibility fields
  ownerId: string;
  ownerRole: UserRole;
  visibility: ResourceVisibility;
  // Lock and pricing fields
  isLocked?: boolean;
  unlockFee?: number;
}

export interface UpdateResourceInput extends Partial<Omit<CreateResourceInput, "topicId" | "uploadthingKey"> & {
  topicId?: string;
  uploadthingKey?: string | null;
  isLocked?: boolean;
  unlockFee?: number;
}> {
  id: string;
}

// Permission-related types
export type Role = InferSelectModel<typeof schema.role>;
export type RolePermission = InferSelectModel<typeof schema.rolePermission>;
export type UserPermission = InferSelectModel<typeof schema.userPermission>;
export type UserRoleAssignment = InferSelectModel<typeof schema.userRoles>;

export interface RoleWithPermissions extends Role {
  permissions: RolePermission[];
}

export interface UserWithPermissions extends User {
  directPermissions: UserPermission[];
  assignedRoles: (UserRoleAssignment & { role: RoleWithPermissions })[];
}

export interface PermissionAssignment {
  permission: string;
  source: "direct" | "role";
  roleName?: string;
  grantedAt: Date;
  grantedBy?: string;
}
