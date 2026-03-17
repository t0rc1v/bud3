"use server";

import { db } from "@/lib/db";
import { aiExam } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Analyze exam patterns: which topics appear most frequently across stored exams.
 */
export async function analyzeExamPatterns(subject: string, level?: string) {
  const conditions = [eq(aiExam.isActive, true), eq(aiExam.subject, subject)];
  if (level) {
    conditions.push(eq(aiExam.level, level));
  }

  // Get all exams for this subject/level
  const exams = await db
    .select({ sections: aiExam.sections, metadata: aiExam.metadata })
    .from(aiExam)
    .where(sql`${aiExam.isActive} = true AND ${aiExam.subject} = ${subject}${level ? sql` AND ${aiExam.level} = ${level}` : sql``}`);

  // Extract topics from sections
  const topicFrequency: Record<string, number> = {};
  const questionTypeFrequency: Record<string, number> = {};

  for (const exam of exams) {
    const sections = exam.sections as Array<{
      sectionTitle: string;
      questions: Array<{ type: string; text: string }>;
    }>;

    for (const section of sections || []) {
      // Count section titles as "topics"
      const topic = section.sectionTitle.replace(/Section \w+:\s*/i, "").trim();
      if (topic) {
        topicFrequency[topic] = (topicFrequency[topic] || 0) + 1;
      }

      for (const q of section.questions || []) {
        questionTypeFrequency[q.type] =
          (questionTypeFrequency[q.type] || 0) + 1;
      }
    }
  }

  // Sort by frequency
  const sortedTopics = Object.entries(topicFrequency)
    .sort(([, a], [, b]) => b - a)
    .map(([topic, count]) => ({
      topic,
      frequency: count,
      confidence: Math.min(100, Math.round((count / exams.length) * 100)),
    }));

  return {
    subject,
    level: level || "all",
    totalExamsAnalyzed: exams.length,
    predictedTopics: sortedTopics.slice(0, 15),
    questionTypeDistribution: questionTypeFrequency,
  };
}

export async function getPredictedTopics(subject: string, level?: string) {
  return analyzeExamPatterns(subject, level);
}
