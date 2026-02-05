import { pgTable, text, integer, boolean, timestamp, uuid, varchar, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';


export const levelEnum = pgEnum("level", ["elementary", "middle_school", "junior_high", "high_school", "higher_education"]);
export const resourceTypeEnum = pgEnum('resource_type', ["notes", "video", "audio", "image"]);
export const userRoleEnum = pgEnum('user_role_enum', ["learner", "teacher", "admin", "super_admin"]);

const createdAt = timestamp("created_at", { withTimezone: true })
	.notNull()
	.defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true })
	.notNull()
	.defaultNow()
	.$onUpdate(() => new Date());


export const user = pgTable("user", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  role: userRoleEnum("role").default("learner").notNull(),
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  createdAt,
  updatedAt,
});

export const grade = pgTable("grade", {
  id: uuid("id").defaultRandom().primaryKey(),
  gradeNumber: integer('grade_number').notNull().unique(),
  title: varchar('title', { length: 100 }).notNull(),
  order: integer('order').notNull(),
  color: varchar('color', { length: 100 }).notNull(),
  level: levelEnum('level').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
  updatedAt,
});

export const subject = pgTable("subject", {
  id: uuid('id').defaultRandom().primaryKey(),
  gradeId: uuid('grade_id').notNull().references(() => grade.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  icon: varchar('icon', { length: 50 }).notNull(),
  color: varchar('color', { length: 100 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
  updatedAt,
});

export const topic = pgTable("topic", {
  id: uuid('id').defaultRandom().primaryKey(),
  subjectId: uuid('subject_id').notNull().references(() => subject.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  order: integer('order').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
  updatedAt,
});

export const resource = pgTable("resource", {
  id: uuid('id').defaultRandom().primaryKey(),
  subjectId: uuid('subject_id').notNull().references(() => subject.id, { onDelete: 'cascade' }),
  topicId: uuid('topic_id').notNull().references(() => topic.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text("description").notNull(),
  type: resourceTypeEnum('type').notNull(),
  url: text('url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  uploadthingKey: text("uploadthing_key"),
  metadata: jsonb('metadata'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
  updatedAt,
});

export const myLearners = pgTable("my_learners", {
  id: uuid('id').defaultRandom().primaryKey(),
  teacherId: uuid('teacher_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  learnerId: uuid('learner_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  learnerEmail: varchar('learner_email', { length: 255 }).notNull(),
  gradeId: uuid('grade_id')
    .notNull()
    .references(() => grade.id, { onDelete: 'restrict' }),
  metadata: jsonb('metadata'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
  updatedAt,
});

// Roles table for role-based permissions (managed by super-admin)
export const role = pgTable("role", {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
  updatedAt,
});

// Role permissions table - links roles to permissions
export const rolePermission = pgTable("role_permission", {
  id: uuid('id').defaultRandom().primaryKey(),
  roleId: uuid('role_id')
    .notNull()
    .references(() => role.id, { onDelete: 'cascade' }),
  permission: varchar('permission', { length: 100 }).notNull(),
  createdAt,
}, (table) => ({
  uniqueRolePermission: { columns: [table.roleId, table.permission] },
}));

// User permissions table - for user-based permissions (admins can have different permissions)
export const userPermission = pgTable("user_permission", {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  permission: varchar('permission', { length: 100 }).notNull(),
  grantedBy: uuid('granted_by')
    .references(() => user.id, { onDelete: 'set null' }),
  grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
  updatedAt,
}, (table) => ({
  uniqueUserPermission: { columns: [table.userId, table.permission] },
}));

// User roles table - links users to roles (optional role assignment)
export const userRoles = pgTable("user_roles", {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  roleId: uuid('role_id')
    .notNull()
    .references(() => role.id, { onDelete: 'cascade' }),
  assignedBy: uuid('assigned_by')
    .references(() => user.id, { onDelete: 'set null' }),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt,
}, (table) => ({
  uniqueUserRole: { columns: [table.userId, table.roleId] },
}));

// Relations
export const userRelations = relations(user, ({ many }) => ({
  teacherLearners: many(myLearners, { relationName: "teacher" }),
  learnerEntries: many(myLearners, { relationName: "learner" }),
  permissions: many(userPermission),
  roles: many(userRoles),
  grantedPermissions: many(userPermission, { relationName: "permissionGranter" }),
  assignedRoles: many(userRoles, { relationName: "roleAssigner" }),
}));

export const gradeRelations = relations(grade, ({ many }) => ({
  subjects: many(subject),
  myLearners: many(myLearners),
}));

export const subjectRelations = relations(subject, ({ one, many }) => ({
  grade: one(grade, {
    fields: [subject.gradeId],
    references: [grade.id],
  }),
  topics: many(topic),
  resources: many(resource),
}));

export const topicRelations = relations(topic, ({ one, many }) => ({
  subject: one(subject, {
    fields: [topic.subjectId],
    references: [subject.id],
  }),
  resources: many(resource),
}));

export const resourceRelations = relations(resource, ({ one }) => ({
  subject: one(subject, {
    fields: [resource.subjectId],
    references: [subject.id],
  }),
  topic: one(topic, {
    fields: [resource.topicId],
    references: [topic.id],
  }),
}));

export const myLearnersRelations = relations(myLearners, ({ one }) => ({
  teacher: one(user, {
    fields: [myLearners.teacherId],
    references: [user.id],
    relationName: "teacher",
  }),
  learner: one(user, {
    fields: [myLearners.learnerId],
    references: [user.id],
    relationName: "learner",
  }),
  grade: one(grade, {
    fields: [myLearners.gradeId],
    references: [grade.id],
  }),
}));

// Role relations
export const roleRelations = relations(role, ({ many }) => ({
  permissions: many(rolePermission),
  userRoles: many(userRoles),
}));

// Role permission relations
export const rolePermissionRelations = relations(rolePermission, ({ one }) => ({
  role: one(role, {
    fields: [rolePermission.roleId],
    references: [role.id],
  }),
}));

// User permission relations
export const userPermissionRelations = relations(userPermission, ({ one }) => ({
  user: one(user, {
    fields: [userPermission.userId],
    references: [user.id],
  }),
  grantedByUser: one(user, {
    fields: [userPermission.grantedBy],
    references: [user.id],
    relationName: "permissionGranter",
  }),
}));

// User role relations
export const userRoleRelations = relations(userRoles, ({ one }) => ({
  user: one(user, {
    fields: [userRoles.userId],
    references: [user.id],
  }),
  role: one(role, {
    fields: [userRoles.roleId],
    references: [role.id],
  }),
  assignedByUser: one(user, {
    fields: [userRoles.assignedBy],
    references: [user.id],
    relationName: "roleAssigner",
  }),
}));

// AI Chat tables
export const chat = pgTable("chat", {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => user.userId, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
  updatedAt,
});

export const chatMessage = pgTable("chat_message", {
  id: uuid('id').defaultRandom().primaryKey(),
  chatId: uuid('chat_id')
    .notNull()
    .references(() => chat.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull(), // 'user', 'assistant', 'tool'
  content: text('content').notNull(),
  metadata: jsonb('metadata'), // for tool calls, attachments, etc.
  createdAt,
  updatedAt,
});

export const aiMemory = pgTable("ai_memory", {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => user.userId, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }),
  content: jsonb('content').notNull(), // structured data
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
  updatedAt,
});

// Chat relations
export const chatRelations = relations(chat, ({ one, many }) => ({
  user: one(user, {
    fields: [chat.userId],
    references: [user.userId],
  }),
  messages: many(chatMessage),
}));

export const chatMessageRelations = relations(chatMessage, ({ one }) => ({
  chat: one(chat, {
    fields: [chatMessage.chatId],
    references: [chat.id],
  }),
}));

export const aiMemoryRelations = relations(aiMemory, ({ one }) => ({
  user: one(user, {
    fields: [aiMemory.userId],
    references: [user.userId],
  }),
}));

// Update user relations to include chat and memory
export const userRelationsExtended = relations(user, ({ many }) => ({
  chats: many(chat),
  aiMemories: many(aiMemory),
}));
