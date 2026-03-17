import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { getTopicDifficulty } from "@/lib/actions/teacher-analytics";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user || user.role === "regular") return new Response("Forbidden", { status: 403 });

  const topics = await getTopicDifficulty();
  return NextResponse.json({ topics });
}
