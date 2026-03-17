import { pgTable, text, integer, boolean, timestamp, uuid, varchar, jsonb, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';


export const resourceTypeEnum = pgEnum('resource_type', ["notes", "video", "audio", "image"]);
export const userRoleEnum = pgEnum('user_role_enum', ["regular", "admin", "super_admin"]);
export const userVerificationEnum = pgEnum('user_verification_enum', ["pending", "approved", "rejected"]);

const createdAt = timestamp("created_at", { withTimezone: true })
	.notNull()
	.defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true })
	.notNull()
	.defaultNow()
	.$onUpdate(() => new Date());


export const user = pgTable("user", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  role: userRoleEnum("role").default("regular").notNull(),
  // Name field for all users
  name: varchar("name", { length: 255 }),
  // Education level for regular users (free text)
  level: varchar("level", { length: 100 }),
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  // Institution fields for admin accounts
  institutionName: varchar("institution_name", { length: 255 }),
  institutionType: varchar("institution_type", { length: 100 }),
  // Verification status for admin accounts
  verificationStatus: userVerificationEnum("verification_status").default("pending"),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  verifiedBy: uuid('verified_by'),
  createdAt,
  updatedAt,
}, (table) => ({
  roleIdx: index("user_role_idx").on(table.role),
}));

// Content visibility enum - shared across all content types
export const contentVisibilityEnum = pgEnum('content_visibility_enum', ["public", "admin_only", "admin_and_regulars", "regular_only"]);

export const level = pgTable("level", {
  id: uuid("id").defaultRandom().primaryKey(),
  levelNumber: integer('level_number').notNull().unique(),
  title: varchar('title', { length: 100 }).notNull(),
  order: integer('order').notNull(),
  color: varchar('color', { length: 100 }).notNull(),
  // Ownership fields
  ownerId: uuid('owner_id').references(() => user.id, { onDelete: 'cascade' }),
  ownerRole: userRoleEnum('owner_role').notNull().default("regular"),
  visibility: contentVisibilityEnum('visibility').notNull().default("regular_only"),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
  updatedAt,
}, (table) => ({
  uniqueLevelOwnerTitle: uniqueIndex("uc_level_owner_title").on(table.ownerId, table.title),
}));

export const subject = pgTable("subject", {
  id: uuid('id').defaultRandom().primaryKey(),
  levelId: uuid('level_id').notNull().references(() => level.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  icon: varchar('icon', { length: 50 }).notNull(),
  color: varchar('color', { length: 100 }).notNull(),
  // Ownership fields
  ownerId: uuid('owner_id').references(() => user.id, { onDelete: 'cascade' }),
  ownerRole: userRoleEnum('owner_role').notNull().default("regular"),
  visibility: contentVisibilityEnum('visibility').notNull().default("regular_only"),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
  updatedAt,
}, (table) => ({
  uniqueSubjectName: uniqueIndex("uc_subject_level_name").on(table.levelId, table.name),
}));

export const topic = pgTable("topic", {
  id: uuid('id').defaultRandom().primaryKey(),
  subjectId: uuid('subject_id').notNull().references(() => subject.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  order: integer('order').notNull(),
  // Ownership fields
  ownerId: uuid('owner_id').references(() => user.id, { onDelete: 'cascade' }),
  ownerRole: userRoleEnum('owner_role').notNull().default("regular"),
  visibility: contentVisibilityEnum('visibility').notNull().default("regular_only"),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
  updatedAt,
}, (table) => ({
  uniqueTopicTitle: uniqueIndex("uc_topic_subject_title").on(table.subjectId, table.title),
}));

export const resourceVisibilityEnum = pgEnum('resource_visibility_enum', ["public", "admin_only", "admin_and_regulars", "regular_only"]);
export const resourceStatusEnum = pgEnum('resource_status_enum', ["draft", "published"]);

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
  // Ownership and visibility fields
  ownerId: uuid('owner_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  ownerRole: userRoleEnum('owner_role').notNull().default("regular"),
  visibility: resourceVisibilityEnum('visibility').notNull().default("regular_only"),
  metadata: jsonb('metadata'),
  // Publish status — draft resources are hidden from learners
  status: resourceStatusEnum('status').notNull().default("published"),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
  updatedAt,
});

export const adminRegulars = pgTable("admin_regulars", {
  id: uuid('id').defaultRandom().primaryKey(),
  adminId: uuid('admin_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  regularId: uuid('regular_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  regularEmail: varchar('regular_email', { length: 255 }).notNull(),
  metadata: jsonb('metadata'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
  updatedAt,
}, (table) => ({
  uniqueAdminRegular: uniqueIndex("uc_admin_regulars").on(table.adminId, table.regularId),
}));

// Super Admin Admins table - tracks which admins belong to which super-admin
export const superAdminAdmins = pgTable("super_admin_admins", {
  id: uuid('id').defaultRandom().primaryKey(),
  superAdminId: uuid('super_admin_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  adminId: uuid('admin_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt,
  updatedAt,
}, (table) => ({
  uniqueSuperAdminAdmin: uniqueIndex("uc_super_admin_admins").on(table.superAdminId, table.adminId),
}));

// Super Admin Regulars table - tracks which regulars belong to which super-admin
export const superAdminRegulars = pgTable("super_admin_regulars", {
  id: uuid('id').defaultRandom().primaryKey(),
  superAdminId: uuid('super_admin_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  regularId: uuid('regular_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  regularEmail: varchar('regular_email', { length: 255 }).notNull(),
  metadata: jsonb('metadata'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
  updatedAt,
}, (table) => ({
  uniqueSuperAdminRegular: uniqueIndex("uc_super_admin_regulars").on(table.superAdminId, table.regularId),
}));

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
  uniqueRolePermission: uniqueIndex("uc_role_permission").on(table.roleId, table.permission),
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
  uniqueUserPermission: uniqueIndex("uc_user_permission").on(table.userId, table.permission),
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
  uniqueUserRole: uniqueIndex("uc_user_roles").on(table.userId, table.roleId),
}));

// Audit log — records significant mutations for super-admin review
export const auditLog = pgTable("audit_log", {
  id: uuid('id').defaultRandom().primaryKey(),
  // Nullable: system-generated events (cron, webhook) may not have a human actor
  actorId: uuid('actor_id').references(() => user.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(), // e.g. "resource.created", "user.role_updated"
  entityType: varchar('entity_type', { length: 50 }).notNull(), // e.g. "resource", "user", "level"
  entityId: varchar('entity_id', { length: 255 }), // the affected row's ID (as string for flexibility)
  metadata: jsonb('metadata'), // additional context (diff, old values, etc.)
  createdAt,
}, (table) => ({
  actorIdx: index("audit_log_actor_idx").on(table.actorId),
  entityIdx: index("audit_log_entity_idx").on(table.entityType, table.entityId),
  createdAtIdx: index("audit_log_created_at_idx").on(table.createdAt),
}));

// Resource view log — tracks which resources learners have opened (5.1 learner progress)
export const resourceView = pgTable("resource_view", {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  resourceId: uuid('resource_id')
    .notNull()
    .references(() => resource.id, { onDelete: 'cascade' }),
  viewedAt: timestamp('viewed_at', { withTimezone: true }).notNull().defaultNow(),
  durationSeconds: integer('duration_seconds'), // null if not tracked
}, (table) => ({
  userResourceIdx: index("resource_view_user_resource_idx").on(table.userId, table.resourceId),
  resourceIdx: index("resource_view_resource_idx").on(table.resourceId),
  viewedAtIdx: index("resource_view_viewed_at_idx").on(table.viewedAt),
}));

// Relations
export const userRelations = relations(user, ({ many }) => ({
  adminRegulars: many(adminRegulars, { relationName: "admin" }),
  regularEntries: many(adminRegulars, { relationName: "regular" }),
  superAdminAdmins: many(superAdminAdmins, { relationName: "superAdmin" }),
  adminOfSuperAdmin: many(superAdminAdmins, { relationName: "adminUser" }),
  superAdminRegulars: many(superAdminRegulars, { relationName: "superAdmin" }),
  regularOfSuperAdmin: many(superAdminRegulars, { relationName: "regularUser" }),
  permissions: many(userPermission),
  roles: many(userRoles),
  grantedPermissions: many(userPermission, { relationName: "permissionGranter" }),
  assignedRoles: many(userRoles, { relationName: "roleAssigner" }),
}));

export const levelRelations = relations(level, ({ many }) => ({
  subjects: many(subject),
}));

export const subjectRelations = relations(subject, ({ one, many }) => ({
  level: one(level, {
    fields: [subject.levelId],
    references: [level.id],
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
  owner: one(user, {
    fields: [resource.ownerId],
    references: [user.id],
  }),
}));

export const adminRegularsRelations = relations(adminRegulars, ({ one }) => ({
  admin: one(user, {
    fields: [adminRegulars.adminId],
    references: [user.id],
    relationName: "admin",
  }),
  regular: one(user, {
    fields: [adminRegulars.regularId],
    references: [user.id],
    relationName: "regular",
  }),
}));

// Super Admin Admins relations
export const superAdminAdminsRelations = relations(superAdminAdmins, ({ one }) => ({
  superAdmin: one(user, {
    fields: [superAdminAdmins.superAdminId],
    references: [user.id],
    relationName: "superAdmin",
  }),
  admin: one(user, {
    fields: [superAdminAdmins.adminId],
    references: [user.id],
    relationName: "adminUser",
  }),
}));

// Super Admin Regulars relations
export const superAdminRegularsRelations = relations(superAdminRegulars, ({ one }) => ({
  superAdmin: one(user, {
    fields: [superAdminRegulars.superAdminId],
    references: [user.id],
    relationName: "superAdmin",
  }),
  regular: one(user, {
    fields: [superAdminRegulars.regularId],
    references: [user.id],
    relationName: "regularUser",
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
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  visibility: varchar('visibility', { length: 20 }).default('private').notNull(),
  shareToken: uuid('share_token'),
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
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
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
    references: [user.id],
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
    references: [user.id],
  }),
}));

// Update user relations to include chat, memory, and credit
export const userRelationsExtended = relations(user, ({ many }) => ({
  chats: many(chat),
  aiMemories: many(aiMemory),
  credit: many(userCredit),
  creditTransactions: many(creditTransaction),
  creditPurchases: many(creditPurchase),
}));

// Credit System Tables
export const userCredit = pgTable("user_credit", {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  balance: integer('balance').notNull().default(0),
  totalPurchased: integer('total_purchased').notNull().default(0),
  totalUsed: integer('total_used').notNull().default(0),
  expiredCredits: integer('expired_credits').notNull().default(0), // Total credits that have expired
  updatedAt,
}, (table) => ({
  uniqueUserCredit: uniqueIndex("uc_user_credit").on(table.userId),
}));

// Credit transaction types
export const transactionTypeEnum = pgEnum("transaction_type", [
  "purchase",
  "usage",
  "refund",
  "gift",
  "bonus",
  "transfer"
]);

// Credit transaction history
export const creditTransaction = pgTable("credit_transaction", {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  type: transactionTypeEnum('type').notNull(),
  amount: integer('amount').notNull(), // positive for credits added, negative for credits used
  balanceAfter: integer('balance_after').notNull(),
  description: text('description'),
  metadata: jsonb('metadata'), // Additional info like resourceId, chatId, etc.
  expiresAt: timestamp('expires_at', { withTimezone: true }), // null means never expires (super-admin gifts)
  createdAt,
}, (table) => ({
  expiresAtIdx: index("ct_expires_at_idx").on(table.expiresAt),
  userExpiresAtIdx: index("ct_user_expires_at_idx").on(table.userId, table.expiresAt),
  userTypeExpiresAtIdx: index("ct_user_type_expires_at_idx").on(table.userId, table.type, table.expiresAt),
}));

// M-Pesa payment tracking
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "refunded"
]);

export const purchaseTypeEnum = pgEnum("purchase_type", [
  "credits"
]);

export const creditPurchase = pgTable("credit_purchase", {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  mpesaReceiptNumber: varchar('mpesa_receipt_number', { length: 50 }),
  checkoutRequestId: varchar('checkout_request_id', { length: 100 }),
  merchantRequestId: varchar('merchant_request_id', { length: 100 }),
  phoneNumber: varchar('phone_number', { length: 20 }),
  amountKes: integer('amount_kes').notNull(), // Amount in KES (Ksh)
  creditsPurchased: integer('credits_purchased').notNull(),
  purchaseType: purchaseTypeEnum('purchase_type').notNull().default("credits"),
  status: paymentStatusEnum('status').notNull().default("pending"),
  resultCode: varchar('result_code', { length: 10 }),
  resultDesc: text('result_desc'),
  transactionDate: timestamp('transaction_date', { withTimezone: true }),
  metadata: jsonb('metadata'),
  createdAt,
  updatedAt,
}, (table) => ({
  statusIdx: index("credit_purchase_status_idx").on(table.status),
  userStatusIdx: index("credit_purchase_user_status_idx").on(table.userId, table.status),
}));


// Relations for credit tables
export const userCreditRelations = relations(userCredit, ({ one, many }) => ({
  user: one(user, {
    fields: [userCredit.userId],
    references: [user.id],
  }),
  transactions: many(creditTransaction),
}));

export const creditTransactionRelations = relations(creditTransaction, ({ one }) => ({
  user: one(user, {
    fields: [creditTransaction.userId],
    references: [user.id],
  }),
}));

export const creditPurchaseRelations = relations(creditPurchase, ({ one }) => ({
  user: one(user, {
    fields: [creditPurchase.userId],
    references: [user.id],
  }),
}));


// AI Generated Assignments Table - for teacher-created printable assignments
export const aiAssignment = pgTable("ai_assignment", {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  chatId: uuid('chat_id')
    .references(() => chat.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 100 }).notNull(),
  level: varchar('level', { length: 100 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'assignment', 'homework', 'quiz', 'test', 'continuous_assessment', 'worksheet'
  instructions: text('instructions').notNull(),
  totalMarks: integer('total_marks').notNull(),
  timeLimit: integer('time_limit'), // in minutes, optional
  dueDate: timestamp('due_date', { withTimezone: true }),
  includeAnswerKey: boolean('include_answer_key').default(true).notNull(),
  questions: jsonb('questions').notNull(), // array of question objects
  answerKey: jsonb('answer_key'), // answer key data
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
  updatedAt,
});

// AI Generated Quizzes Table - for learner interactive quizzes
export const aiQuiz = pgTable("ai_quiz", {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  chatId: uuid('chat_id')
    .references(() => chat.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 100 }).notNull(),
  description: text('description'),
  instructions: text('instructions').notNull(),
  totalMarks: integer('total_marks').notNull(),
  passingScore: integer('passing_score').default(60).notNull(), // percentage
  timeLimit: integer('time_limit'), // in minutes, optional
  settings: jsonb('settings').notNull(), // quiz settings object
  questions: jsonb('questions').notNull(), // array of question objects with options
  validation: jsonb('validation').notNull(), // correct answers for validation
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
  updatedAt,
});

// Quiz Attempts Table - track user quiz attempts and scores
export const aiQuizAttempt = pgTable("ai_quiz_attempt", {
  id: uuid('id').defaultRandom().primaryKey(),
  quizId: uuid('quiz_id')
    .notNull()
    .references(() => aiQuiz.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  answers: jsonb('answers').notNull(), // user's submitted answers
  score: integer('score').notNull(), // earned marks
  totalMarks: integer('total_marks').notNull(),
  percentage: integer('percentage').notNull(),
  passed: boolean('passed').notNull(),
  timeTaken: integer('time_taken'), // in seconds, optional
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt,
});

// AI Generated Flashcards Table - for interactive flashcard study sets
export const aiFlashcard = pgTable("ai_flashcard", {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  chatId: uuid('chat_id')
    .references(() => chat.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 100 }).notNull(),
  topic: varchar('topic', { length: 255 }),
  totalCards: integer('total_cards').notNull(),
  cards: jsonb('cards').notNull(), // array of flashcard objects {id, front, back, tags, difficulty}
  settings: jsonb('settings'), // study settings {shuffle, showDifficulty, reviewMode}
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
  updatedAt,
});

// Relations for assignments, quizzes, and flashcards
export const aiAssignmentRelations = relations(aiAssignment, ({ one }) => ({
  user: one(user, {
    fields: [aiAssignment.userId],
    references: [user.id],
  }),
  chat: one(chat, {
    fields: [aiAssignment.chatId],
    references: [chat.id],
  }),
}));

export const aiQuizRelations = relations(aiQuiz, ({ one, many }) => ({
  user: one(user, {
    fields: [aiQuiz.userId],
    references: [user.id],
  }),
  chat: one(chat, {
    fields: [aiQuiz.chatId],
    references: [chat.id],
  }),
  attempts: many(aiQuizAttempt),
}));

export const aiQuizAttemptRelations = relations(aiQuizAttempt, ({ one }) => ({
  quiz: one(aiQuiz, {
    fields: [aiQuizAttempt.quizId],
    references: [aiQuiz.id],
  }),
  user: one(user, {
    fields: [aiQuizAttempt.userId],
    references: [user.id],
  }),
}));

export const aiFlashcardRelations = relations(aiFlashcard, ({ one }) => ({
  user: one(user, {
    fields: [aiFlashcard.userId],
    references: [user.id],
  }),
  chat: one(chat, {
    fields: [aiFlashcard.chatId],
    references: [chat.id],
  }),
}));

// AI Notes Document Table — comprehensive study documents
export const aiNotesDocument = pgTable("ai_notes_document", {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  chatId: uuid('chat_id').references(() => chat.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 100 }).notNull(),
  topic: varchar('topic', { length: 255 }),
  level: varchar('level', { length: 100 }),
  sections: jsonb('sections').notNull(),       // [{heading, content (markdown), type}]
  keyTerms: jsonb('key_terms'),                // [{term, definition}]
  youtubeVideos: jsonb('youtube_videos'),      // [{title, url, description}]
  images: jsonb('images'),                     // [{url, caption, alt}]
  summary: text('summary'),
  resourceIds: jsonb('resource_ids'),          // string[]
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
  updatedAt,
});

// AI Exam Table — generated exams from past-paper analysis
export const aiExam = pgTable("ai_exam", {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  chatId: uuid('chat_id').references(() => chat.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 100 }).notNull(),
  level: varchar('level', { length: 100 }).notNull(),
  instructions: text('instructions').notNull(),
  totalMarks: integer('total_marks').notNull(),
  timeLimit: integer('time_limit'),            // minutes, nullable
  sections: jsonb('sections').notNull(),       // [{sectionTitle, sectionInstructions, marks, questions[]}]
  answerKey: jsonb('answer_key'),              // [{questionId, sectionTitle, correctAnswer, marks, explanation}]
  includeAnswerKey: boolean('include_answer_key').default(true).notNull(),
  resourceIds: jsonb('resource_ids'),          // string[]
  metadata: jsonb('metadata'),                 // {patternAnalysis, difficultyDistribution}
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
  updatedAt,
});

export const aiNotesDocumentRelations = relations(aiNotesDocument, ({ one }) => ({
  user: one(user, { fields: [aiNotesDocument.userId], references: [user.id] }),
  chat: one(chat, { fields: [aiNotesDocument.chatId], references: [chat.id] }),
}));

export const aiExamRelations = relations(aiExam, ({ one }) => ({
  user: one(user, { fields: [aiExam.userId], references: [user.id] }),
  chat: one(chat, { fields: [aiExam.chatId], references: [chat.id] }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actor: one(user, {
    fields: [auditLog.actorId],
    references: [user.id],
  }),
}));

export const resourceViewRelations = relations(resourceView, ({ one }) => ({
  user: one(user, {
    fields: [resourceView.userId],
    references: [user.id],
  }),
  resource: one(resource, {
    fields: [resourceView.resourceId],
    references: [resource.id],
  }),
}));

// ============ LEARNER EXPERIENCE TABLES ============

export const progressStatusEnum = pgEnum('progress_status', ['not_started', 'started', 'completed']);

// Per-resource completion state per learner
export const resourceProgress = pgTable("resource_progress", {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  resourceId: uuid('resource_id').notNull().references(() => resource.id, { onDelete: 'cascade' }),
  status: progressStatusEnum('status').notNull().default('not_started'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt,
  updatedAt,
}, (table) => ({
  uniqueUserResource: uniqueIndex("uc_resource_progress").on(table.userId, table.resourceId),
  userStatusIdx: index("rp_user_status_idx").on(table.userId, table.status),
  resourceStatusIdx: index("rp_resource_status_idx").on(table.resourceId, table.status),
}));

// Saved/bookmarked resources per learner
export const resourceBookmark = pgTable("resource_bookmark", {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  resourceId: uuid('resource_id').notNull().references(() => resource.id, { onDelete: 'cascade' }),
  createdAt,
}, (table) => ({
  uniqueUserResourceBookmark: uniqueIndex("uc_resource_bookmark").on(table.userId, table.resourceId),
  userIdx: index("rb_user_idx").on(table.userId),
}));

// Private per-resource notes (one per user per resource)
export const resourceNote = pgTable("resource_note", {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  resourceId: uuid('resource_id').notNull().references(() => resource.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  createdAt,
  updatedAt,
}, (table) => ({
  userResourceIdx: index("rn_user_resource_idx").on(table.userId, table.resourceId),
}));

export const ratingValueEnum = pgEnum('rating_value', ['up', 'down']);

// Thumbs up/down rating per learner per resource
export const resourceRating = pgTable("resource_rating", {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  resourceId: uuid('resource_id').notNull().references(() => resource.id, { onDelete: 'cascade' }),
  rating: ratingValueEnum('rating').notNull(),
  createdAt,
  updatedAt,
}, (table) => ({
  uniqueUserResourceRating: uniqueIndex("uc_resource_rating").on(table.userId, table.resourceId),
  resourceIdx: index("rr_resource_idx").on(table.resourceId),
}));

// Relations
export const resourceProgressRelations = relations(resourceProgress, ({ one }) => ({
  user: one(user, { fields: [resourceProgress.userId], references: [user.id] }),
  resource: one(resource, { fields: [resourceProgress.resourceId], references: [resource.id] }),
}));

export const resourceBookmarkRelations = relations(resourceBookmark, ({ one }) => ({
  user: one(user, { fields: [resourceBookmark.userId], references: [user.id] }),
  resource: one(resource, { fields: [resourceBookmark.resourceId], references: [resource.id] }),
}));

export const resourceNoteRelations = relations(resourceNote, ({ one }) => ({
  user: one(user, { fields: [resourceNote.userId], references: [user.id] }),
  resource: one(resource, { fields: [resourceNote.resourceId], references: [resource.id] }),
}));

export const resourceRatingRelations = relations(resourceRating, ({ one }) => ({
  user: one(user, { fields: [resourceRating.userId], references: [user.id] }),
  resource: one(resource, { fields: [resourceRating.resourceId], references: [resource.id] }),
}));

// ============ PHASE 1: AUTO-GRADING ============

export const submissionStatusEnum = pgEnum('submission_status', [
  'submitted', 'grading', 'graded', 'reviewed', 'published',
]);

export const gradeByEnum = pgEnum('grade_by', ['ai', 'teacher']);
export const gradeStatusEnum = pgEnum('grade_status', ['draft', 'published']);

export const aiSubmission = pgTable("ai_submission", {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  examId: uuid('exam_id').references(() => aiExam.id, { onDelete: 'set null' }),
  assignmentId: uuid('assignment_id').references(() => aiAssignment.id, { onDelete: 'set null' }),
  type: varchar('type', { length: 20 }).notNull(), // 'exam' | 'assignment' | 'quiz'
  answers: jsonb('answers').notNull(),
  fileUrl: text('file_url'),
  status: submissionStatusEnum('status').notNull().default('submitted'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
  updatedAt,
}, (table) => ({
  userStatusIdx: index("ai_submission_user_status_idx").on(table.userId, table.status),
  examIdx: index("ai_submission_exam_idx").on(table.examId),
  assignmentIdx: index("ai_submission_assignment_idx").on(table.assignmentId),
}));

export const aiGrade = pgTable("ai_grade", {
  id: uuid('id').defaultRandom().primaryKey(),
  submissionId: uuid('submission_id').notNull().references(() => aiSubmission.id, { onDelete: 'cascade' }).unique(),
  gradedBy: gradeByEnum('graded_by').notNull(),
  teacherId: uuid('teacher_id').references(() => user.id, { onDelete: 'set null' }),
  totalScore: integer('total_score').notNull(),
  maxScore: integer('max_score').notNull(),
  percentage: integer('percentage').notNull(),
  passed: boolean('passed').notNull(),
  perQuestionFeedback: jsonb('per_question_feedback').notNull(),
  overallFeedback: text('overall_feedback'),
  rubric: jsonb('rubric'),
  aiConfidence: integer('ai_confidence'),
  teacherOverrides: jsonb('teacher_overrides'),
  status: gradeStatusEnum('status').notNull().default('draft'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
  updatedAt,
});

export const aiSubmissionRelations = relations(aiSubmission, ({ one }) => ({
  user: one(user, { fields: [aiSubmission.userId], references: [user.id] }),
  exam: one(aiExam, { fields: [aiSubmission.examId], references: [aiExam.id] }),
  assignment: one(aiAssignment, { fields: [aiSubmission.assignmentId], references: [aiAssignment.id] }),
  grade: one(aiGrade),
}));

export const aiGradeRelations = relations(aiGrade, ({ one }) => ({
  submission: one(aiSubmission, { fields: [aiGrade.submissionId], references: [aiSubmission.id] }),
  teacher: one(user, { fields: [aiGrade.teacherId], references: [user.id] }),
}));

// ============ PHASE 2: ADAPTIVE LEARNING ============

export const studyPlanStatusEnum = pgEnum('study_plan_status', ['active', 'completed', 'paused']);

export const studyPlan = pgTable("study_plan", {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 100 }).notNull(),
  level: varchar('level', { length: 100 }),
  status: studyPlanStatusEnum('status').notNull().default('active'),
  goals: jsonb('goals'),
  schedule: jsonb('schedule'),
  weeklyHoursTarget: integer('weekly_hours_target'),
  startDate: timestamp('start_date', { withTimezone: true }).notNull().defaultNow(),
  endDate: timestamp('end_date', { withTimezone: true }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
  updatedAt,
});

export const studyPlanProgress = pgTable("study_plan_progress", {
  id: uuid('id').defaultRandom().primaryKey(),
  planId: uuid('plan_id').notNull().references(() => studyPlan.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  date: timestamp('date', { withTimezone: true }).notNull().defaultNow(),
  activitiesCompleted: jsonb('activities_completed'),
  timeSpentMinutes: integer('time_spent_minutes'),
  notes: text('notes'),
  createdAt,
});

export const flashcardRatingEnum = pgEnum('flashcard_rating', ['again', 'hard', 'good', 'easy']);

export const flashcardReview = pgTable("flashcard_review", {
  id: uuid('id').defaultRandom().primaryKey(),
  flashcardSetId: uuid('flashcard_set_id').notNull().references(() => aiFlashcard.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  cardId: varchar('card_id', { length: 100 }).notNull(),
  rating: flashcardRatingEnum('rating').notNull(),
  interval: integer('interval').notNull(), // days until next review
  easeFactor: integer('ease_factor').notNull(), // stored as integer (×1000, e.g. 2500 = 2.5)
  nextReviewDate: timestamp('next_review_date', { withTimezone: true }).notNull(),
  reviewCount: integer('review_count').notNull().default(1),
  createdAt,
}, (table) => ({
  userNextReviewIdx: index("fr_user_next_review_idx").on(table.userId, table.nextReviewDate),
}));

export const weaknessProfile = pgTable("weakness_profile", {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  topicId: uuid('topic_id').references(() => topic.id, { onDelete: 'set null' }),
  subject: varchar('subject', { length: 100 }).notNull(),
  weaknessScore: integer('weakness_score').notNull(), // 0-100, higher = weaker
  evidenceData: jsonb('evidence_data'),
  lastAssessedAt: timestamp('last_assessed_at', { withTimezone: true }).notNull().defaultNow(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
  updatedAt,
}, (table) => ({
  userWeaknessIdx: index("wp_user_weakness_idx").on(table.userId, table.weaknessScore),
}));

export const studyPlanRelations = relations(studyPlan, ({ one, many }) => ({
  user: one(user, { fields: [studyPlan.userId], references: [user.id] }),
  progress: many(studyPlanProgress),
}));

export const studyPlanProgressRelations = relations(studyPlanProgress, ({ one }) => ({
  plan: one(studyPlan, { fields: [studyPlanProgress.planId], references: [studyPlan.id] }),
  user: one(user, { fields: [studyPlanProgress.userId], references: [user.id] }),
}));

export const flashcardReviewRelations = relations(flashcardReview, ({ one }) => ({
  flashcardSet: one(aiFlashcard, { fields: [flashcardReview.flashcardSetId], references: [aiFlashcard.id] }),
  user: one(user, { fields: [flashcardReview.userId], references: [user.id] }),
}));

export const weaknessProfileRelations = relations(weaknessProfile, ({ one }) => ({
  user: one(user, { fields: [weaknessProfile.userId], references: [user.id] }),
  topic: one(topic, { fields: [weaknessProfile.topicId], references: [topic.id] }),
}));

// ============ PHASE 3: AI TUTOR ============

export const tutorModeEnum = pgEnum('tutor_mode', ['socratic', 'guided', 'practice']);
export const tutorSessionStatusEnum = pgEnum('tutor_session_status', ['active', 'completed']);

export const tutorSession = pgTable("tutor_session", {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  chatId: uuid('chat_id').notNull().references(() => chat.id, { onDelete: 'cascade' }),
  subject: varchar('subject', { length: 100 }).notNull(),
  topic: varchar('topic', { length: 255 }).notNull(),
  level: varchar('level', { length: 100 }),
  mode: tutorModeEnum('mode').notNull().default('socratic'),
  misconceptions: jsonb('misconceptions'),
  conceptsMastered: jsonb('concepts_mastered'),
  sessionStats: jsonb('session_stats'),
  status: tutorSessionStatusEnum('status').notNull().default('active'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
  updatedAt,
});

export const tutorSessionRelations = relations(tutorSession, ({ one }) => ({
  user: one(user, { fields: [tutorSession.userId], references: [user.id] }),
  chat: one(chat, { fields: [tutorSession.chatId], references: [chat.id] }),
}));

// ============ PHASE 4: CURRICULUM IMPORT ============

export const curriculumImportStatusEnum = pgEnum('curriculum_import_status', [
  'uploading', 'extracting', 'processing', 'review', 'approved', 'applied', 'failed',
]);

export const curriculumImport = pgTable("curriculum_import", {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  sourceType: varchar('source_type', { length: 20 }).notNull(), // 'syllabus' | 'past_paper' | 'notes'
  sourceResourceId: uuid('source_resource_id').references(() => resource.id, { onDelete: 'set null' }),
  sourceUrl: text('source_url'),
  extractedContent: jsonb('extracted_content'),
  proposedStructure: jsonb('proposed_structure'),
  status: curriculumImportStatusEnum('status').notNull().default('uploading'),
  appliedEntities: jsonb('applied_entities'),
  errorMessage: text('error_message'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
  updatedAt,
});

export const curriculumImportRelations = relations(curriculumImport, ({ one }) => ({
  user: one(user, { fields: [curriculumImport.userId], references: [user.id] }),
  sourceResource: one(resource, { fields: [curriculumImport.sourceResourceId], references: [resource.id] }),
}));

// ============ PHASE 6: QUALITY CHECK ============

export const aiQualityCheck = pgTable("ai_quality_check", {
  id: uuid('id').defaultRandom().primaryKey(),
  submissionId: uuid('submission_id').notNull().references(() => aiSubmission.id, { onDelete: 'cascade' }),
  originalityScore: integer('originality_score'),
  similarityResults: jsonb('similarity_results'),
  qualityFeedback: jsonb('quality_feedback'),
  flagged: boolean('flagged').default(false).notNull(),
  flagReason: text('flag_reason'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
});

export const aiQualityCheckRelations = relations(aiQualityCheck, ({ one }) => ({
  submission: one(aiSubmission, { fields: [aiQualityCheck.submissionId], references: [aiSubmission.id] }),
}));

// ============ PHASE 10: PARENT REPORTS ============

export const parentReport = pgTable("parent_report", {
  id: uuid('id').defaultRandom().primaryKey(),
  studentId: uuid('student_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  generatedBy: uuid('generated_by').notNull().references(() => user.id, { onDelete: 'cascade' }),
  reportType: varchar('report_type', { length: 20 }).notNull(), // 'weekly' | 'monthly' | 'custom'
  period: jsonb('period').notNull(), // { startDate, endDate }
  content: jsonb('content').notNull(),
  emailSent: boolean('email_sent').default(false).notNull(),
  emailSentAt: timestamp('email_sent_at', { withTimezone: true }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
});

export const parentReportRelations = relations(parentReport, ({ one }) => ({
  student: one(user, { fields: [parentReport.studentId], references: [user.id] }),
  generator: one(user, { fields: [parentReport.generatedBy], references: [user.id] }),
}));
