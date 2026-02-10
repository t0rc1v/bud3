import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resource, unlockFee, user } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getResources } from "@/lib/actions/teacher";
import { DEFAULT_CREDIT_CONFIG } from "@/lib/mpesa";

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

    // Check if user is admin or super_admin
    const currentUser = await db.query.user.findFirst({
      where: eq(user.userId, userId),
    });

    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "super_admin")) {
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
      const existingFee = await db.query.unlockFee.findFirst({
        where: and(
          eq(unlockFee.resourceId, resourceData.id),
          eq(unlockFee.isActive, true)
        ),
      });

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
