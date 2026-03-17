import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { submitAnswers } from "@/lib/actions/grading";
import { gradeSubmissionWithAI } from "@/lib/actions/grading";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { createNotification } from "@/lib/actions/notifications";

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  const rl = checkRateLimit(`ai-submissions:${clerkId}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many submissions. Please slow down." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const user = await getUserByClerkId(clerkId);
  if (!user) return new Response("User not found", { status: 404 });

  const body = await req.json();
  const { examId, assignmentId, type, answers, fileUrl } = body;

  if (!type || !answers) {
    return NextResponse.json(
      { error: "type and answers are required" },
      { status: 400 }
    );
  }

  const submission = await submitAnswers({
    userId: user.id,
    examId,
    assignmentId,
    type,
    answers,
    fileUrl,
  });

  // Auto-grade MCQ submissions immediately
  let grade = null;
  try {
    grade = await gradeSubmissionWithAI(submission.id);
    if (grade) {
      createNotification({
        userId: user.id,
        type: "grading_complete",
        title: "Submission Graded",
        body: `Your ${type} submission has been graded.`,
        metadata: { submissionId: submission.id, percentage: grade.percentage },
      }).catch(() => {});
    }
  } catch (error) {
    console.error("Auto-grading failed:", error);
  }

  return NextResponse.json({ submission, grade });
}
