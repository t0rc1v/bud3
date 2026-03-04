import { pgTable, text, integer, boolean, timestamp, uuid, varchar, jsonb, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';


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
});

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
});

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
});

export const resourceVisibilityEnum = pgEnum('resource_visibility_enum', ["public", "admin_only", "admin_and_regulars", "regular_only"]);

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
  // Lock and pricing fields
  isLocked: boolean('is_locked').default(false).notNull(),
  unlockFee: integer('unlock_fee').default(0).notNull(), // Fee in KES (0 means free)
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
  unlockedContent: many(unlockedContent),
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
  "unlock",
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
  "credits",
  "unlock"
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

// Unlock fees configuration
export const unlockableTypeEnum = pgEnum("unlockable_type", [
  "resource",
  "topic",
  "subject"
]);

export const unlockFee = pgTable("unlock_fee", {
  id: uuid('id').defaultRandom().primaryKey(),
  type: unlockableTypeEnum('type').notNull(),
  resourceId: uuid('resource_id').references(() => resource.id, { onDelete: 'cascade' }),
  topicId: uuid('topic_id').references(() => topic.id, { onDelete: 'cascade' }),
  subjectId: uuid('subject_id').references(() => subject.id, { onDelete: 'cascade' }),
  feeAmount: integer('fee_amount').notNull().default(100), // Default Ksh 100
  creditsRequired: integer('credits_required').notNull().default(50), // Credits needed to unlock
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
  updatedAt,
}, (table) => ({
  // One fee record per resource/topic/subject (NULLs are distinct in Postgres unique indexes)
  uniqueResourceFee: uniqueIndex("uc_unlock_fee_resource").on(table.resourceId),
  uniqueTopicFee: uniqueIndex("uc_unlock_fee_topic").on(table.topicId),
  uniqueSubjectFee: uniqueIndex("uc_unlock_fee_subject").on(table.subjectId),
  isActiveIdx: index("unlock_fee_is_active_idx").on(table.isActive),
}));

// Track unlocked content per user
// Note: All unlocks are done via direct M-Pesa payment (not credits)
// Credits are only used for AI chat responses
export const unlockedContent = pgTable("unlocked_content", {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  unlockFeeId: uuid('unlock_fee_id')
    .notNull()
    .references(() => unlockFee.id, { onDelete: 'cascade' }),
  // M-Pesa payment receipt number for tracking
  paymentReference: varchar('payment_reference', { length: 100 }),
  // Amount paid in KES (for record keeping)
  amountPaidKes: integer('amount_paid_kes').notNull().default(0),
  unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt,
}, (table) => ({
  uniqueUserUnlock: uniqueIndex("uc_unlocked_content").on(table.userId, table.unlockFeeId),
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

export const unlockFeeRelations = relations(unlockFee, ({ one, many }) => ({
  resource: one(resource, {
    fields: [unlockFee.resourceId],
    references: [resource.id],
  }),
  topic: one(topic, {
    fields: [unlockFee.topicId],
    references: [topic.id],
  }),
  subject: one(subject, {
    fields: [unlockFee.subjectId],
    references: [subject.id],
  }),
  unlockedBy: many(unlockedContent),
}));

export const unlockedContentRelations = relations(unlockedContent, ({ one }) => ({
  user: one(user, {
    fields: [unlockedContent.userId],
    references: [user.id],
  }),
  unlockFee: one(unlockFee, {
    fields: [unlockedContent.unlockFeeId],
    references: [unlockFee.id],
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
