import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getNoteForResource, upsertNote, deleteNote } from "@/lib/actions/learner";

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

    const note = await getNoteForResource(dbUser.id, resourceId);
    return NextResponse.json({ note });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = checkRateLimit(`notes:${clerkId}`, 30, 60_000);
    if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

    const body = await req.json();
    const { resourceId, content } = body ?? {};

    if (!resourceId || !UUID_RE.test(resourceId)) {
      return NextResponse.json({ error: "Invalid resourceId" }, { status: 400 });
    }
    if (typeof content !== "string") {
      return NextResponse.json({ error: "content must be a string" }, { status: 400 });
    }
    if (content.length > 4000) {
      return NextResponse.json({ error: "Note too long (max 4000 characters)" }, { status: 400 });
    }

    const dbUser = await getUserByClerkId(clerkId);
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const note = await upsertNote(dbUser.id, resourceId, content);
    return NextResponse.json({ note });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { resourceId } = body ?? {};

    if (!resourceId || !UUID_RE.test(resourceId)) {
      return NextResponse.json({ error: "Invalid resourceId" }, { status: 400 });
    }

    const dbUser = await getUserByClerkId(clerkId);
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    await deleteNote(dbUser.id, resourceId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
