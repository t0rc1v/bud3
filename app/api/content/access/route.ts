import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { resource, unlockFee, unlockedContent, user } from "@/lib/db/schema";

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

    // Get the resource
    const resourceData = await db.query.resource.findFirst({
      where: eq(resource.id, resourceId),
    });

    if (!resourceData) {
      return NextResponse.json(
        { error: "Resource not found" },
        { status: 404 }
      );
    }

    // Check if there's an unlock fee for this resource
    // All resources require unlock fee by default in our system
    const currentUser = await db.query.user.findFirst({
      where: eq(user.clerkId, userId),
    });

    if (!currentUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check for unlock fee record
    const unlockFeeRecord = await db.query.unlockFee.findFirst({
      where: and(
        eq(unlockFee.resourceId, resourceId),
        eq(unlockFee.isActive, true)
      ),
    });

    if (!unlockFeeRecord) {
      // No unlock fee set yet - resource is effectively locked but no fee configured
      // Return as locked with default fee information
      return NextResponse.json({
        hasAccess: false,
        isLocked: true,
        unlockFee: {
          creditsRequired: 50, // Default
          feeAmount: 100, // Default Ksh 100
        },
        resource: {
          id: resourceData.id,
          title: resourceData.title,
          type: resourceData.type,
        },
      });
    }

    // Check if user has unlocked this content
    const unlockedRecord = await db.query.unlockedContent.findFirst({
      where: and(
        eq(unlockedContent.userId, userId),
        eq(unlockedContent.unlockFeeId, unlockFeeRecord.id)
      ),
    });

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
        creditsRequired: unlockFeeRecord.creditsRequired,
        feeAmount: unlockFeeRecord.feeAmount,
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
