import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getResourceProgress, upsertResourceProgress } from "@/lib/actions/learner";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resourceId = req.nextUrl.searchParams.get("resourceId");
    if (!resourceId || !UUID_RE.test(resourceId)) {
      return NextResponse.json({ error: "Invalid resourceId" }, { status: 400 });
    }

    const dbUser = await getUserByClerkId(clerkId);
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const progress = await getResourceProgress(dbUser.id, resourceId);
    return NextResponse.json({ progress: progress ?? { status: "not_started" } });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = checkRateLimit(`progress:${clerkId}`, 60, 60_000);
    if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

    const body = await req.json();
    const { resourceId, status } = body ?? {};

    if (!resourceId || !UUID_RE.test(resourceId)) {
      return NextResponse.json({ error: "Invalid resourceId" }, { status: 400 });
    }
    if (status !== "started" && status !== "completed") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const dbUser = await getUserByClerkId(clerkId);
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const progress = await upsertResourceProgress(dbUser.id, resourceId, status);
    return NextResponse.json({ progress });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
