"use server";

import { db } from "@/lib/db";
import { aiQualityCheck, aiSubmission } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function checkPlagiarism(submissionId: string) {
  const [submission] = await db
    .select()
    .from(aiSubmission)
    .where(eq(aiSubmission.id, submissionId));

  if (!submission) throw new Error("Submission not found");

  const answers = submission.answers as Array<{ answer: string }>;
  const submissionText = answers.map((a) => a.answer).join("\n");

  // Get other submissions for the same assessment to compare against
  const col = submission.examId ? aiSubmission.examId : aiSubmission.assignmentId;
  const assessmentId = submission.examId || submission.assignmentId;

  let referenceSources: Array<{ id: string; text: string; title?: string }> = [];

  if (assessmentId) {
    const otherSubmissions = await db
      .select()
      .from(aiSubmission)
      .where(eq(col, assessmentId));

    referenceSources = otherSubmissions
      .filter((s) => s.id !== submissionId)
      .map((s) => ({
        id: s.id,
        text: (s.answers as Array<{ answer: string }>)
          .map((a) => a.answer)
          .join("\n"),
        title: `Submission ${s.id.slice(0, 8)}`,
      }));
  }

  const { checkSimilarity } = await import("@/lib/ai/plagiarism");
  const result = checkSimilarity(submissionText, referenceSources);

  const originalityScore = 100 - result.maxSimilarity;
  const flagged = result.maxSimilarity > 70; // Flag if >70% similar

  const [check] = await db
    .insert(aiQualityCheck)
    .values({
      submissionId,
      originalityScore,
      similarityResults: result.allResults,
      flagged,
      flagReason: flagged
        ? `High similarity (${result.maxSimilarity}%) with ${result.matchedSourceTitle}`
        : null,
    })
    .returning();

  return check;
}

export async function checkWritingQuality(submissionId: string) {
  const [submission] = await db
    .select()
    .from(aiSubmission)
    .where(eq(aiSubmission.id, submissionId));

  if (!submission) throw new Error("Submission not found");

  const answers = submission.answers as Array<{ answer: string }>;
  const text = answers.map((a) => a.answer).join("\n");

  // Basic quality metrics
  const wordCount = text.split(/\s+/).length;
  const sentenceCount = text.split(/[.!?]+/).length;
  const avgWordsPerSentence =
    sentenceCount > 0 ? wordCount / sentenceCount : 0;

  const qualityFeedback = {
    wordCount,
    sentenceCount,
    avgWordsPerSentence,
    readabilityLevel:
      avgWordsPerSentence < 15
        ? "easy"
        : avgWordsPerSentence < 25
          ? "moderate"
          : "complex",
  };

  return qualityFeedback;
}

export async function getQualityCheck(submissionId: string) {
  const [check] = await db
    .select()
    .from(aiQualityCheck)
    .where(eq(aiQualityCheck.submissionId, submissionId));
  return check || null;
}
