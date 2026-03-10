import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateResource, getResourceRatingCounts } from "@/lib/actions/learner";

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

    const [counts, userRatingRows] = await Promise.all([
      getResourceRatingCounts(resourceId),
      (async () => {
        const { db } = await import("@/lib/db");
        const { resourceRating } = await import("@/lib/db/schema");
        const { eq, and } = await import("drizzle-orm");
        return db
          .select({ rating: resourceRating.rating })
          .from(resourceRating)
          .where(and(eq(resourceRating.userId, dbUser.id), eq(resourceRating.resourceId, resourceId)))
          .limit(1)
          .then((r) => r[0] ?? null);
      })(),
    ]);

    return NextResponse.json({
      counts,
      userRating: userRatingRows?.rating ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = checkRateLimit(`ratings:${clerkId}`, 30, 60_000);
    if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

    const body = await req.json();
    const { resourceId, rating } = body ?? {};

    if (!resourceId || !UUID_RE.test(resourceId)) {
      return NextResponse.json({ error: "Invalid resourceId" }, { status: 400 });
    }
    if (rating !== "up" && rating !== "down" && rating !== null) {
      return NextResponse.json({ error: "Invalid rating value" }, { status: 400 });
    }

    const dbUser = await getUserByClerkId(clerkId);
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const result = await rateResource(dbUser.id, resourceId, rating);
    const counts = await getResourceRatingCounts(resourceId);

    return NextResponse.json({ rating: result?.rating ?? null, counts });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
