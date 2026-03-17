import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { logStudyPlanProgress, getStudyPlanProgress } from "@/lib/actions/study-plans";
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
  const progress = await getStudyPlanProgress(id);
  return NextResponse.json({ progress });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user) return new Response("User not found", { status: 404 });

  const { id } = await params;
  const body = await req.json();
  const progress = await logStudyPlanProgress({
    planId: id,
    userId: user.id,
    ...body,
  });
  return NextResponse.json({ progress });
}
