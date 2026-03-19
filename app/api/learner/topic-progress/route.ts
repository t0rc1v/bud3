import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { getTopicProgressStats } from "@/lib/actions/learner";

export async function GET(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  const user = await getUserByClerkId(clerkId);
  if (!user) return new Response("User not found", { status: 404 });

  const { searchParams } = new URL(req.url);
  const topicId = searchParams.get("topicId");
  if (!topicId) return NextResponse.json({ error: "topicId required" }, { status: 400 });

  const stats = await getTopicProgressStats(user.id, topicId);
  return NextResponse.json(stats);
}
