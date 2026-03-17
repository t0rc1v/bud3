import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { submitAnswers } from "@/lib/actions/grading";
import { gradeSubmissionWithAI } from "@/lib/actions/grading";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

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
  } catch (error) {
    console.error("Auto-grading failed:", error);
  }

  return NextResponse.json({ submission, grade });
}
