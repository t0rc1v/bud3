"use server";

import { db } from "@/lib/db";
import { grade, subject, topic, resource } from "@/lib/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type {
  CreateGradeInput,
  UpdateGradeInput,
  CreateSubjectInput,
  UpdateSubjectInput,
  CreateTopicInput,
  UpdateTopicInput,
  CreateResourceInput,
  UpdateResourceInput,
  GradeWithSubjects,
  SubjectWithTopics,
  TopicWithResources,
  TopicWithResourcesAndSubject,
  ResourceWithRelations,
  GradeWithFullHierarchy,
  SubjectWithTopicsAndGrade,
  Grade,
  Subject,
  Topic,
  Resource,
} from "@/lib/types";

// Grade Actions
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

export async function createGrade(input: CreateGradeInput): Promise<void> {
  await db.insert(grade).values({
    gradeNumber: input.gradeNumber,
    title: input.title,
    order: input.order,
    color: input.color,
    level: input.level,
    isActive: true,
  });
  revalidatePath("/admin/grades");
}

export async function updateGrade(input: UpdateGradeInput): Promise<void> {
  const { id, ...data } = input;
  await db
    .update(grade)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(grade.id, id));
  revalidatePath("/admin/grades");
}

export async function deleteGrade(id: string): Promise<void> {
  await db.delete(grade).where(eq(grade.id, id));
  revalidatePath("/admin/grades");
}

// Subject Actions
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

export async function createSubject(input: CreateSubjectInput): Promise<void> {
  await db.insert(subject).values({
    gradeId: input.gradeId,
    name: input.name,
    icon: input.icon,
    color: input.color,
    isActive: true,
  });
  revalidatePath("/admin/subjects");
}

export async function updateSubject(input: UpdateSubjectInput): Promise<void> {
  const { id, ...data } = input;
  await db
    .update(subject)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(subject.id, id));
  revalidatePath("/admin/subjects");
}

export async function deleteSubject(id: string): Promise<void> {
  await db.delete(subject).where(eq(subject.id, id));
  revalidatePath("/admin/subjects");
}

// Topic Actions
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

export async function createTopic(input: CreateTopicInput): Promise<void> {
  await db.insert(topic).values({
    subjectId: input.subjectId,
    title: input.title,
    order: input.order,
    isActive: true,
  });
  revalidatePath("/admin/topics");
}

export async function updateTopic(input: UpdateTopicInput): Promise<void> {
  const { id, ...data } = input;
  await db
    .update(topic)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(topic.id, id));
  revalidatePath("/admin/topics");
}

export async function deleteTopic(id: string): Promise<void> {
  await db.delete(topic).where(eq(topic.id, id));
  revalidatePath("/admin/topics");
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

export async function createResource(input: CreateResourceInput): Promise<void> {
  await db.insert(resource).values({
    subjectId: input.subjectId,
    topicId: input.topicId ?? null,
    title: input.title,
    description: input.description,
    type: input.type,
    url: input.url,
    thumbnailUrl: input.thumbnailUrl ?? null,
    uploadthingKey: input.uploadthingKey,
    metadata: input.metadata ?? null,
    isActive: true,
    createdAt: new Date(),
  });
  revalidatePath("/admin/resources");
}

export async function updateResource(input: UpdateResourceInput): Promise<void> {
  const { id, ...data } = input;
  await db
    .update(resource)
    .set({
      ...data,
      topicId: data.topicId ?? null,
      thumbnailUrl: data.thumbnailUrl ?? null,
      metadata: data.metadata ?? null,
    })
    .where(eq(resource.id, id));
  revalidatePath("/admin/resources");
}

export async function deleteResource(id: string): Promise<void> {
  await db.delete(resource).where(eq(resource.id, id));
  revalidatePath("/admin/resources");
}
