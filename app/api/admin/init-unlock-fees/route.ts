import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resource, unlockFee } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getResources } from "@/lib/actions/admin";
import { DEFAULT_CREDIT_CONFIG } from "@/lib/mpesa";
import { checkUserPermission } from "@/lib/actions/admin-permissions";
import { FinancePermissions } from "@/lib/permissions";
import { checkRateLimit } from "@/lib/rate-limit";

// This endpoint initializes unlock fees for all resources that don't have one
export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Rate limit: 10 bulk-init requests per minute per user
    const rateLimit = checkRateLimit(`init-unlock-fees:${userId}`, 10, 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
        }
      );
    }

    // Check granular permission instead of raw role check
    const hasPermission = await checkUserPermission(userId, FinancePermissions.UNLOCK_FEE_MANAGE);
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Get all resources
    const allResources = await getResources();
    
    // Create unlock fees for resources that don't have one
    let createdCount = 0;
    let skippedCount = 0;

    for (const resourceData of allResources) {
      // Check if unlock fee already exists
      const existingFee = await db
        .select()
        .from(unlockFee)
        .where(and(
          eq(unlockFee.resourceId, resourceData.id),
          eq(unlockFee.isActive, true)
        ))
        .limit(1)
        .then(res => res[0] || null);

      if (existingFee) {
        skippedCount++;
        continue;
      }

      // Create unlock fee with default values
      await db.insert(unlockFee).values({
        type: "resource",
        resourceId: resourceData.id,
        feeAmount: DEFAULT_CREDIT_CONFIG.defaultUnlockFeeKes,
        creditsRequired: DEFAULT_CREDIT_CONFIG.defaultUnlockCredits,
        isActive: true,
      });

      createdCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Unlock fees initialized successfully`,
      created: createdCount,
      skipped: skippedCount,
      total: allResources.length,
    });

  } catch (error) {
    console.error("Initialize unlock fees error:", error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "Failed to initialize unlock fees" 
      },
      { status: 500 }
    );
  }
}
