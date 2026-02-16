import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { unlockedContent, resource, user, unlockFee } from "@/lib/db/schema";
import { getResourceUnlockFee, verifyPaymentForResource } from "@/lib/actions/credits";
import { DEFAULT_CREDIT_CONFIG } from "@/lib/mpesa";
import { checkRateLimit } from "@/lib/rate-limit";

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

    // Rate limiting: 5 unlock attempts per minute per user
    const rateLimitResult = checkRateLimit(`unlock:${clerkId}`, {
      maxRequests: 5,
      windowMs: 60 * 1000, // 1 minute
    });

    if (!rateLimitResult.isAllowed) {
      return NextResponse.json(
        { error: "Too many unlock attempts. Please try again later." },
        { status: 429, headers: rateLimitResult.headers }
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

    // Get unlock fee for this resource using single source of truth
    const unlockFeeData = await getResourceUnlockFee(resourceId);
    
    if (!unlockFeeData.unlockFeeId) {
      return NextResponse.json(
        { error: "Failed to create unlock fee for this resource" },
        { status: 500 }
      );
    }
    
    // For database queries, we still need the full record
    const unlockFeeRecord = await db
      .select()
      .from(unlockFee)
      .where(eq(unlockFee.id, unlockFeeData.unlockFeeId))
      .limit(1)
      .then(res => res[0]);

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
      // SECURITY: Verify the payment was actually completed before unlocking
      if (!paymentReference) {
        return NextResponse.json(
          { error: "Payment reference is required for M-Pesa payment" },
          { status: 400 }
        );
      }
      
      const verification = await verifyPaymentForResource(
        paymentReference,
        unlockFeeRecord.feeAmount,
        dbUserId
      );
      
      if (!verification.isValid) {
        console.error(`Payment verification failed for user ${dbUserId}: ${verification.error}`);
        return NextResponse.json(
          { error: verification.error || "Payment verification failed" },
          { status: 400 }
        );
      }
      
      [newUnlock] = await db.insert(unlockedContent).values({
        userId: dbUserId,
        unlockFeeId: unlockFeeRecord.id,
        paymentReference: paymentReference,
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

    // Rate limiting: 30 status checks per minute per user
    const rateLimitResult = checkRateLimit(`unlock_status:${clerkId}`, {
      maxRequests: 30,
      windowMs: 60 * 1000, // 1 minute
    });

    if (!rateLimitResult.isAllowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: rateLimitResult.headers }
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

    // Get unlock fee using single source of truth
    const { calculateCreditsRequired } = await import("@/lib/calculator");
    const unlockFeeData = await getResourceUnlockFee(resourceId);
    
    // Use only unlockFee table as source of truth
    const feeAmount = unlockFeeData.feeAmount;
    const effectiveUnlockFeeId = unlockFeeData.unlockFeeId;
    const creditsRequired = unlockFeeData.creditsRequired;

    // Check if unlocked
    let isUnlocked = false;
    let unlockedAt: Date | null = null;
    
    if (effectiveUnlockFeeId) {
      const unlockedRecord = await db
        .select()
        .from(unlockedContent)
        .where(and(
          eq(unlockedContent.userId, dbUserId),
          eq(unlockedContent.unlockFeeId, effectiveUnlockFeeId)
        ))
        .limit(1)
        .then(res => res[0] || null);
      
      isUnlocked = !!unlockedRecord;
      unlockedAt = unlockedRecord?.unlockedAt || null;
    }

    // Get user credit balance
    const { getActiveCreditBalance } = await import("@/lib/actions/credits");
    const userCredits = await getActiveCreditBalance(dbUserId);
    // Use creditsRequired from unlockFeeData (single source of truth)

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
