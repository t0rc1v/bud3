import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkUserPermission } from "@/lib/actions/admin-permissions";
import { RewardPermissions } from "@/lib/permissions";
import { unlockContentForUser } from "@/lib/actions/credits";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { user } from "@/lib/db/schema";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is super_admin or has credit_reward permission
    const currentUser = await db.query.user.findFirst({
      where: eq(user.clerkId, userId),
    });

    const isSuperAdmin = currentUser?.role === "super_admin";
    const hasPermission = isSuperAdmin || await checkUserPermission(userId, RewardPermissions.CREDIT_REWARD);
    
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Forbidden - You don't have permission to unlock content for users" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { userEmail, resourceId, topicId, subjectId } = body;

    // Validate inputs
    if (!userEmail) {
      return NextResponse.json(
        { error: "User email is required" },
        { status: 400 }
      );
    }

    if (!resourceId && !topicId && !subjectId) {
      return NextResponse.json(
        { error: "Resource ID, Topic ID, or Subject ID is required" },
        { status: 400 }
      );
    }

    // Find user by email
    const targetUser = await db.query.user.findFirst({
      where: eq(user.email, userEmail),
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: `User with email ${userEmail} not found` },
        { status: 404 }
      );
    }

    // Unlock content
    const result = await unlockContentForUser({
      userId: targetUser.clerkId,
      resourceId,
      topicId,
      subjectId,
      unlockedBy: userId,
      reason: body.reason || "Admin unlock",
    });

    return NextResponse.json({
      success: true,
      message: `Content unlocked successfully for ${userEmail}`,
      unlockId: result.unlockId,
    });

  } catch (error) {
    console.error("Unlock content error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to unlock content" 
      },
      { status: 500 }
    );
  }
}
