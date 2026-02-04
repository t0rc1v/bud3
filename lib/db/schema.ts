import { pgTable, text, integer, boolean, timestamp, uuid, varchar, jsonb, pgEnum } from 'drizzle-orm/pg-core';


export const levelEnum = pgEnum("level", ["elementary", "middle_school", "junior_high", "high_school", "higher_education"]);
export const resourceTypeEnum = pgEnum('resource_type', ["notes", "video", "audio", "image"]);
export const userRoleEnum = pgEnum('user_role', ["learner", "teacher", "admin"]);

const createdAt = timestamp("created_at", { withTimezone: true })
	.notNull()
	.defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true })
	.notNull()
	.defaultNow()
	.$onUpdate(() => new Date());


export const user = pgTable("user", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  role: userRoleEnum("role").default("learner").notNull(),
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
  topicId: uuid('topic_id').references(() => topic.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text("description").notNull(),
  type: resourceTypeEnum('type').notNull(),
  url: text('url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  uploadthingKey: text("uploadthing_key").notNull(),
  metadata: jsonb('metadata'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt,
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