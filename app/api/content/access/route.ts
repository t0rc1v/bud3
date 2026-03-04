import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { resource, unlockFee, unlockedContent, user } from "@/lib/db/schema";
import { getResourceUnlockFee } from "@/lib/actions/credits";
import { DEFAULT_CREDIT_CONFIG } from "@/lib/mpesa";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const resourceId = searchParams.get("resourceId");

    if (!resourceId) {
      return NextResponse.json(
        { error: "Resource ID is required" },
        { status: 400 }
      );
    }

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(resourceId)) {
      return NextResponse.json(
        { error: "Invalid resource ID format" },
        { status: 400 }
      );
    }

    // Get the resource
    const resourceData = await db
      .select()
      .from(resource)
      .where(eq(resource.id, resourceId))
      .limit(1)
      .then(res => res[0] || null);

    if (!resourceData) {
      return NextResponse.json(
        { error: "Resource not found" },
        { status: 404 }
      );
    }

    // Check if there's an unlock fee for this resource
    // All resources require unlock fee by default in our system
    const currentUser = await db
      .select()
      .from(user)
      .where(eq(user.clerkId, userId))
      .limit(1)
      .then(res => res[0] || null);

    if (!currentUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Get unlock fee using single source of truth
    const unlockFeeData = await getResourceUnlockFee(resourceId);
    
    // Check if user has unlocked this content
    let unlockedRecord = null;
    if (unlockFeeData.unlockFeeId) {
      unlockedRecord = await db
        .select()
        .from(unlockedContent)
        .where(and(
          eq(unlockedContent.userId, currentUser.id),
          eq(unlockedContent.unlockFeeId, unlockFeeData.unlockFeeId)
        ))
        .limit(1)
        .then(res => res[0] || null);
    }

    if (unlockedRecord) {
      return NextResponse.json({
        hasAccess: true,
        isLocked: false,
        unlockedAt: unlockedRecord.unlockedAt,
        resource: {
          id: resourceData.id,
          title: resourceData.title,
          type: resourceData.type,
        },
      });
    }

    // User has not unlocked this resource
    return NextResponse.json({
      hasAccess: false,
      isLocked: true,
      unlockFee: {
        creditsRequired: unlockFeeData.creditsRequired,
        feeAmount: unlockFeeData.feeAmount,
      },
      resource: {
        id: resourceData.id,
        title: resourceData.title,
        type: resourceData.type,
      },
    });

  } catch (error) {
    console.error("Check resource access error:", error);
    return NextResponse.json(
      { error: "Failed to check resource access" },
      { status: 500 }
    );
  }
}
