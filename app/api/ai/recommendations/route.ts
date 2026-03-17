import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { getRecommendations } from "@/lib/actions/recommendations";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user) return new Response("User not found", { status: 404 });

  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "10", 10);

  const recommendations = await getRecommendations(user.id, limit);
  return NextResponse.json({ recommendations });
}
