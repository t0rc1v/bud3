import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { getSubmissionById, getGrade } from "@/lib/actions/grading";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  const user = await getUserByClerkId(clerkId);
  if (!user) return new Response("User not found", { status: 404 });

  const { id } = await params;
  const submission = await getSubmissionById(id);
  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  // Only allow owner or admin to view
  if (submission.userId !== user.id && user.role === "regular") {
    return new Response("Forbidden", { status: 403 });
  }

  const grade = await getGrade(id);

  return NextResponse.json({ submission, grade });
}
