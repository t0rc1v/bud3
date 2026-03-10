import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { toggleBookmark, getUserBookmarks } from "@/lib/actions/learner";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await getUserByClerkId(clerkId);
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const bookmarks = await getUserBookmarks(dbUser.id);
    return NextResponse.json({ bookmarks });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = checkRateLimit(`bookmarks:${clerkId}`, 30, 60_000);
    if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

    const body = await req.json();
    const { resourceId } = body ?? {};

    if (!resourceId || !UUID_RE.test(resourceId)) {
      return NextResponse.json({ error: "Invalid resourceId" }, { status: 400 });
    }

    const dbUser = await getUserByClerkId(clerkId);
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const result = await toggleBookmark(dbUser.id, resourceId);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
