import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getLevelsFullHierarchy } from "@/lib/actions/admin";
import { getUserByClerkId } from "@/lib/actions/auth";
import { db } from "@/lib/db";
import { unlockFee, unlockedContent } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { DEFAULT_CREDIT_CONFIG } from "@/lib/mpesa";

export async function GET(req: Request) {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Convert Clerk ID to DB UUID — unlockedContent.userId stores the DB UUID
    const dbUser = await getUserByClerkId(clerkId);
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const levels = await getLevelsFullHierarchy({ publishedOnly: true });

    // Collect all resource IDs from the full hierarchy
    const resourceIds = levels.flatMap(l =>
      (l.subjects || []).flatMap(s =>
        (s.topics || []).flatMap(t =>
          (t.resources || []).map(r => r.id)
        )
      )
    );

    // Batch-load unlock fees and user unlocks in 2 queries (replaces O(N) per-resource queries)
    const [allFees, userUnlocks] = await Promise.all([
      resourceIds.length > 0
        ? db.select().from(unlockFee).where(
            and(
              inArray(unlockFee.resourceId, resourceIds),
              eq(unlockFee.isActive, true)
            )
          )
        : [],
      db
        .select({ unlockFeeId: unlockedContent.unlockFeeId })
        .from(unlockedContent)
        .where(eq(unlockedContent.userId, dbUser.id)),
    ]);

    // Build lookup maps for O(1) access during mapping
    const feeByResourceId = new Map(allFees.map(f => [f.resourceId!, f]));
    const unlockedFeeIds = new Set(userUnlocks.map(u => u.unlockFeeId));

    const levelsWithUnlockStatus = levels.map(level => ({
      id: level.id,
      title: level.title,
      subjects: (level.subjects || []).map(subject => ({
        id: subject.id,
        name: subject.name,
        topics: (subject.topics || []).map(topic => ({
          id: topic.id,
          title: topic.title,
          resources: (topic.resources || []).map(resource => {
            const fee = feeByResourceId.get(resource.id);
            const feeAmount = fee?.feeAmount ?? DEFAULT_CREDIT_CONFIG.defaultUnlockFeeKes;
            const isUnlocked = fee ? unlockedFeeIds.has(fee.id) : false;
            // DO NOT include url — must use proxy endpoint for security
            return {
              id: resource.id,
              title: resource.title,
              type: resource.type,
              unlockFee: feeAmount,
              isUnlocked,
            };
          }),
        })),
      })),
    }));

    return NextResponse.json({ levels: levelsWithUnlockStatus });

  } catch (error) {
    console.error("Levels with unlock status error:", error);
    return NextResponse.json(
      { error: "Failed to load content" },
      { status: 500 }
    );
  }
}
