import { type InferSelectModel } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

export type Grade = InferSelectModel<typeof schema.grade>;
export type Subject = InferSelectModel<typeof schema.subject>;
export type Topic = InferSelectModel<typeof schema.topic>;
export type Resource = InferSelectModel<typeof schema.resource>;
export type User = InferSelectModel<typeof schema.user>;

export interface TopicWithResources extends Topic {
  resources: Resource[];
}

export interface TopicWithResourcesAndSubject extends Topic {
  resources: Resource[];
  subject: Subject;
}

export interface SubjectWithTopics extends Subject {
  topics: TopicWithResources[];
}

export interface SubjectWithTopicsAndGrade extends Subject {
  topics: Topic[];
  grade: Grade;
}

export interface GradeWithSubjects extends Grade {
  subjects: Subject[];
}

export interface GradeWithFullHierarchy extends Grade {
  subjects: SubjectWithTopics[];
}

export interface ResourceWithRelations extends Resource {
  subject: Subject;
  topic: Topic | null;
}

export type ResourceType = "notes" | "video" | "audio" | "image";
export type UserRole = "learner" | "teacher" | "admin";
export type Level = "elementary" | "middle_school" | "junior_high" | "high_school" | "higher_education";

export interface CreateGradeInput {
  gradeNumber: number;
  title: string;
  order: number;
  color: string;
  level: Level;
}

export interface UpdateGradeInput extends Partial<CreateGradeInput> {
  id: string;
}

export interface CreateSubjectInput {
  gradeId: string;
  name: string;
  icon: string;
  color: string;
}

export interface UpdateSubjectInput extends Partial<CreateSubjectInput> {
  id: string;
}

export interface CreateTopicInput {
  subjectId: string;
  title: string;
  order: number;
}

export interface UpdateTopicInput extends Partial<CreateTopicInput> {
  id: string;
}

export interface CreateResourceInput {
  subjectId: string;
  topicId?: string;
  title: string;
  description: string;
  type: ResourceType;
  url: string;
  thumbnailUrl?: string;
  uploadthingKey: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateResourceInput extends Partial<Omit<CreateResourceInput, "uploadthingKey">> {
  id: string;
}
