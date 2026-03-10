import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { getUserProgressSummary, getLastAccessedResource } from "@/lib/actions/learner";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await getUserByClerkId(clerkId);
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const [summary, lastAccessed] = await Promise.all([
      getUserProgressSummary(dbUser.id),
      getLastAccessedResource(dbUser.id),
    ]);

    return NextResponse.json({ summary, lastAccessed });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
