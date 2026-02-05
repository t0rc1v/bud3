"use server";

import { db } from "@/lib/db";
import { grade, subject, topic, resource, myLearners, user } from "@/lib/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getUserByEmail } from "./auth";
import type {
  GradeWithSubjects,
  SubjectWithTopics,
  TopicWithResources,
  SubjectWithTopicsAndGrade,
  TopicWithResourcesAndSubject,
  GradeWithFullHierarchy,
  ResourceWithRelations,
  CreateResourceInput,
  Resource,
  User,
} from "@/lib/types";

// Grade Actions (read-only)
export async function getGrades(): Promise<GradeWithSubjects[]> {
  const grades = await db.query.grade.findMany({
    orderBy: [asc(grade.order)],
    with: {
      subjects: true,
    },
  });
  return grades;
}

export async function getGradesFullHierarchy(): Promise<GradeWithFullHierarchy[]> {
  const grades = await db.query.grade.findMany({
    orderBy: [asc(grade.order)],
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
  return grades as unknown as GradeWithFullHierarchy[];
}

export async function getGradeById(id: string): Promise<GradeWithSubjects | null> {
  const result = await db.query.grade.findFirst({
    where: eq(grade.id, id),
    with: {
      subjects: true,
    },
  });
  return result ?? null;
}

// Subject Actions (read-only)
export async function getSubjects(): Promise<SubjectWithTopicsAndGrade[]> {
  const subjects = await db.query.subject.findMany({
    orderBy: [asc(subject.name)],
    with: {
      topics: true,
      grade: true,
    },
  });
  return subjects;
}

export async function getSubjectsByGradeId(gradeId: string): Promise<SubjectWithTopicsAndGrade[]> {
  const subjects = await db.query.subject.findMany({
    where: eq(subject.gradeId, gradeId),
    orderBy: [asc(subject.name)],
    with: {
      topics: true,
      grade: true,
    },
  });
  return subjects;
}

export async function getSubjectById(id: string): Promise<SubjectWithTopicsAndGrade | null> {
  const result = await db.query.subject.findFirst({
    where: eq(subject.id, id),
    with: {
      topics: true,
      grade: true,
    },
  });
  return result ?? null;
}

// Topic Actions (read-only)
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

export async function getTopicsBySubjectId(subjectId: string): Promise<TopicWithResourcesAndSubject[]> {
  const topics = await db.query.topic.findMany({
    where: eq(topic.subjectId, subjectId),
    orderBy: [asc(topic.order)],
    with: {
      resources: true,
      subject: true,
    },
  });
  return topics;
}

export async function getTopicById(id: string): Promise<TopicWithResources | null> {
  const result = await db.query.topic.findFirst({
    where: eq(topic.id, id),
    with: {
      resources: true,
      subject: true,
    },
  });
  return result ?? null;
}

// Resource Actions
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

export async function getResourcesByTopicId(topicId: string): Promise<ResourceWithRelations[]> {
  const resources = await db.query.resource.findMany({
    where: eq(resource.topicId, topicId),
    orderBy: [desc(resource.createdAt)],
    with: {
      subject: true,
      topic: true,
    },
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

// Create resource (for teachers)
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
    isActive: true,
    createdAt: new Date(),
  });
  revalidatePath("/teacher");
  revalidatePath("/learner");
}

// My Learners Actions (teacher only)
export interface MyLearnerWithDetails {
  id: string;
  teacherId: string;
  learnerId: string;
  learnerEmail: string;
  gradeId: string;
  metadata: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  learner: User | null;
  grade: typeof grade.$inferSelect;
}

export async function getMyLearners(teacherId: string): Promise<MyLearnerWithDetails[]> {
  const learners = await db.query.myLearners.findMany({
    where: eq(myLearners.teacherId, teacherId),
    with: {
      learner: true,
      grade: true,
    },
    orderBy: [desc(myLearners.createdAt)],
  });
  return learners as MyLearnerWithDetails[];
}

export async function addMyLearner(
  teacherId: string,
  learnerEmail: string,
  gradeId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  // Find the learner by email
  const learner = await getUserByEmail(learnerEmail);
  
  if (!learner) {
    throw new Error("Learner not found. Please ensure the learner has registered with this email.");
  }

  if (learner.role !== "learner") {
    throw new Error("The specified user is not a learner.");
  }

  // Check if already added
  const existing = await db.query.myLearners.findFirst({
    where: and(
      eq(myLearners.teacherId, teacherId),
      eq(myLearners.learnerId, learner.id)
    ),
  });

  if (existing) {
    throw new Error("This learner is already in your list.");
  }

  await db.insert(myLearners).values({
    teacherId,
    learnerId: learner.id,
    learnerEmail,
    gradeId,
    metadata: metadata || null,
    isActive: true,
  });

  revalidatePath("/teacher/my-learners");
}

export async function removeMyLearner(teacherId: string, learnerId: string): Promise<void> {
  await db
    .delete(myLearners)
    .where(
      and(
        eq(myLearners.teacherId, teacherId),
        eq(myLearners.learnerId, learnerId)
      )
    );

  revalidatePath("/teacher/my-learners");
}

export async function updateMyLearnerMetadata(
  teacherId: string,
  learnerId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await db
    .update(myLearners)
    .set({
      metadata,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(myLearners.teacherId, teacherId),
        eq(myLearners.learnerId, learnerId)
      )
    );

  revalidatePath("/teacher/my-learners");
}

export async function updateMyLearnerGrade(
  teacherId: string,
  learnerId: string,
  gradeId: string
): Promise<void> {
  await db
    .update(myLearners)
    .set({
      gradeId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(myLearners.teacherId, teacherId),
        eq(myLearners.learnerId, learnerId)
      )
    );

  revalidatePath("/teacher/my-learners");
}
