import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { unlockedContent, resource, user } from "@/lib/db/schema";
import { getUnlockFeeByResource } from "@/lib/actions/credits";
import { DEFAULT_CREDIT_CONFIG } from "@/lib/mpesa";

/**
 * POST /api/content/unlock
 * Unlock a resource using either M-Pesa payment or credits
 * Supports both payment methods: "mpesa" (direct payment) or "credits"
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
    const userData = await db
      .select()
      .from(user)
      .where(eq(user.clerkId, clerkId))
      .limit(1)
      .then(res => res[0] || null);
    
    if (!userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    const dbUserId = userData.id;

    const body = await req.json();
    const { resourceId, paymentMethod = "mpesa", paymentReference } = body;

    if (!resourceId) {
      return NextResponse.json(
        { error: "Resource ID is required" },
        { status: 400 }
      );
    }

    // First, fetch the resource to get its unlock fee
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

    // Get unlock fee for this resource
    let unlockFeeRecord = await getUnlockFeeByResource(resourceId);
    
    if (!unlockFeeRecord) {
      // Auto-create unlock fee with resource's price (if set) or default
      const { createUnlockFee } = await import("@/lib/actions/credits");
      const { calculateCreditsRequired } = await import("@/lib/calculator");
      
      // Use resource's unlockFee if it's greater than 0, otherwise use default
      const feeAmount = resourceData.unlockFee > 0 
        ? resourceData.unlockFee 
        : DEFAULT_CREDIT_CONFIG.defaultUnlockFeeKes;
      
      unlockFeeRecord = await createUnlockFee({
        type: "resource",
        resourceId,
        feeAmount,
        creditsRequired: calculateCreditsRequired(feeAmount),
      });
    }

    if (!unlockFeeRecord) {
      return NextResponse.json(
        { error: "Failed to create unlock fee for this resource" },
        { status: 500 }
      );
    }

    // Check if user has already unlocked this content
    const existingUnlock = await db
      .select()
      .from(unlockedContent)
      .where(and(
        eq(unlockedContent.userId, dbUserId),
        eq(unlockedContent.unlockFeeId, unlockFeeRecord.id)
      ))
      .limit(1)
      .then(res => res[0] || null);

    if (existingUnlock) {
      return NextResponse.json({
        success: true,
        message: "Content is already unlocked",
        unlockId: existingUnlock.id,
        alreadyUnlocked: true,
      });
    }

    // Resource data already fetched earlier for pricing
    let newUnlock;
    let paymentResult;

    if (paymentMethod === "credits") {
      // Use credits to unlock content
      const { unlockContentWithCredits } = await import("@/lib/actions/credits");
      paymentResult = await unlockContentWithCredits(
        dbUserId,
        unlockFeeRecord.id,
        unlockFeeRecord.feeAmount
      );
      newUnlock = { id: paymentResult.unlockId };
    } else {
      // Default: Use M-Pesa direct payment
      [newUnlock] = await db.insert(unlockedContent).values({
        userId: dbUserId,
        unlockFeeId: unlockFeeRecord.id,
        paymentReference: paymentReference || null,
        amountPaidKes: unlockFeeRecord.feeAmount,
        unlockedAt: new Date(),
      }).returning();
    }

    return NextResponse.json({
      success: true,
      message: "Content unlocked successfully",
      unlockId: newUnlock.id,
      paymentMethod,
      paymentReference: paymentMethod === "mpesa" ? (paymentReference || null) : null,
      creditsUsed: paymentMethod === "credits" ? paymentResult?.creditsUsed : null,
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
 * Check unlock status for a resource and get pricing details
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
    const userData = await db
      .select()
      .from(user)
      .where(eq(user.clerkId, clerkId))
      .limit(1)
      .then(res => res[0] || null);
    
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

    // Fetch the resource to get its unlock fee
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

    // Get unlock fee record
    const unlockFeeRecord = await getUnlockFeeByResource(resourceId);
    const { calculateCreditsRequired } = await import("@/lib/calculator");
    
    // Determine the actual fee amount:
    // 1. Use resource's unlockFee if set (> 0)
    // 2. Fall back to unlockFeeRecord if exists
    // 3. Finally fall back to default
    let feeAmount: number;
    let effectiveUnlockFeeId: string | null = null;
    
    if (resourceData.unlockFee > 0) {
      // Resource has a specific price set - use that
      feeAmount = resourceData.unlockFee;
    } else if (unlockFeeRecord) {
      // Use existing unlock fee record
      feeAmount = unlockFeeRecord.feeAmount;
      effectiveUnlockFeeId = unlockFeeRecord.id;
    } else {
      // No price set anywhere - use default
      feeAmount = DEFAULT_CREDIT_CONFIG.defaultUnlockFeeKes;
    }

    // Check if unlocked (only if we have an unlock fee record)
    let isUnlocked = false;
    let unlockedAt: Date | null = null;
    
    if (unlockFeeRecord) {
      const unlockedRecord = await db
        .select()
        .from(unlockedContent)
        .where(and(
          eq(unlockedContent.userId, dbUserId),
          eq(unlockedContent.unlockFeeId, unlockFeeRecord.id)
        ))
        .limit(1)
        .then(res => res[0] || null);
      
      isUnlocked = !!unlockedRecord;
      unlockedAt = unlockedRecord?.unlockedAt || null;
    }

    // Get user credit balance
    const { getActiveCreditBalance } = await import("@/lib/actions/credits");
    const userCredits = await getActiveCreditBalance(dbUserId);
    const creditsRequired = calculateCreditsRequired(feeAmount);

    return NextResponse.json({
      isUnlocked,
      unlockedAt,
      unlockFee: {
        feeAmount,
        creditsRequired,
      },
      userCredits,
      hasEnoughCredits: userCredits >= creditsRequired,
    });

  } catch (error) {
    console.error("Check unlock status error:", error);
    return NextResponse.json(
      { error: "Failed to check unlock status" },
      { status: 500 }
    );
  }
}
