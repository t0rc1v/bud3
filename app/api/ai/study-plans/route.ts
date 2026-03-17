import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { createStudyPlan, getStudyPlansByUser } from "@/lib/actions/study-plans";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user) return new Response("User not found", { status: 404 });

  const plans = await getStudyPlansByUser(user.id);
  return NextResponse.json({ plans });
}

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user) return new Response("User not found", { status: 404 });

  const body = await req.json();
  const plan = await createStudyPlan({ userId: user.id, ...body });
  return NextResponse.json({ plan });
}
