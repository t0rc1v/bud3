import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { unlockedContent, resource, user } from "@/lib/db/schema";
import { getUnlockFeeByResource } from "@/lib/actions/credits";
import { DEFAULT_CREDIT_CONFIG } from "@/lib/mpesa";

/**
 * POST /api/content/unlock
 * Unlock a resource after successful M-Pesa payment
 * This is called after payment is confirmed via STK push
 */
export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get the database user ID from the clerk ID
    const userData = await db.query.user.findFirst({
      where: eq(user.clerkId, clerkId),
    });
    
    if (!userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    const dbUserId = userData.id;

    const body = await req.json();
    const { resourceId, paymentReference } = body;

    if (!resourceId) {
      return NextResponse.json(
        { error: "Resource ID is required" },
        { status: 400 }
      );
    }

    // Get unlock fee for this resource
    let unlockFeeRecord = await getUnlockFeeByResource(resourceId);
    
    if (!unlockFeeRecord) {
      // Auto-create unlock fee with default values
      const { createUnlockFee } = await import("@/lib/actions/credits");
      unlockFeeRecord = await createUnlockFee({
        type: "resource",
        resourceId,
        feeAmount: DEFAULT_CREDIT_CONFIG.defaultUnlockFeeKes,
        creditsRequired: DEFAULT_CREDIT_CONFIG.defaultUnlockCredits,
      });
    }

    if (!unlockFeeRecord) {
      return NextResponse.json(
        { error: "Failed to create unlock fee for this resource" },
        { status: 500 }
      );
    }

    // Check if user has already unlocked this content
    const existingUnlock = await db.query.unlockedContent.findFirst({
      where: and(
        eq(unlockedContent.userId, dbUserId),
        eq(unlockedContent.unlockFeeId, unlockFeeRecord.id)
      ),
    });

    if (existingUnlock) {
      return NextResponse.json({
        success: true,
        message: "Content is already unlocked",
        unlockId: existingUnlock.id,
        alreadyUnlocked: true,
      });
    }

    // Get resource details for metadata
    const resourceData = await db.query.resource.findFirst({
      where: eq(resource.id, resourceId),
    });

    // Create unlock record for direct M-Pesa payment
    // Note: All unlocks are via M-Pesa direct payment (credits are only for AI chat)
    const [newUnlock] = await db.insert(unlockedContent).values({
      userId: dbUserId,
      unlockFeeId: unlockFeeRecord.id,
      paymentReference: paymentReference || null,
      amountPaidKes: unlockFeeRecord.feeAmount,
      unlockedAt: new Date(),
    }).returning();

    return NextResponse.json({
      success: true,
      message: "Content unlocked successfully",
      unlockId: newUnlock.id,
      paymentReference: paymentReference || null,
      resource: resourceData ? {
        id: resourceData.id,
        title: resourceData.title,
        type: resourceData.type,
      } : null,
    });

  } catch (error) {
    console.error("Content unlock error:", error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "Failed to unlock content" 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/content/unlock
 * Check unlock status for a resource
 */
export async function GET(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get the database user ID from the clerk ID
    const userData = await db.query.user.findFirst({
      where: eq(user.clerkId, clerkId),
    });
    
    if (!userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    const dbUserId = userData.id;

    const { searchParams } = new URL(req.url);
    const resourceId = searchParams.get("resourceId");

    if (!resourceId) {
      return NextResponse.json(
        { error: "Resource ID is required" },
        { status: 400 }
      );
    }

    // Get unlock fee
    const unlockFeeRecord = await getUnlockFeeByResource(resourceId);
    
    if (!unlockFeeRecord) {
      return NextResponse.json({
        isUnlocked: false,
        unlockFee: {
          feeAmount: DEFAULT_CREDIT_CONFIG.defaultUnlockFeeKes,
        },
      });
    }

    // Check if unlocked
    const unlockedRecord = await db.query.unlockedContent.findFirst({
      where: and(
        eq(unlockedContent.userId, dbUserId),
        eq(unlockedContent.unlockFeeId, unlockFeeRecord.id)
      ),
    });

    return NextResponse.json({
      isUnlocked: !!unlockedRecord,
      unlockedAt: unlockedRecord?.unlockedAt,
      unlockFee: {
        feeAmount: unlockFeeRecord.feeAmount,
      },
    });

  } catch (error) {
    console.error("Check unlock status error:", error);
    return NextResponse.json(
      { error: "Failed to check unlock status" },
      { status: 500 }
    );
  }
}
