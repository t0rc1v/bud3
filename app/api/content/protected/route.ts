import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { resource, unlockFee, unlockedContent, user } from "@/lib/db/schema";
import { getResourceUnlockFee } from "@/lib/actions/credits";

/**
 * Check if a user has access to a resource
 * All resources are locked by default and require unlock fee payment
 */
export async function checkResourceAccess(dbUserId: string, resourceId: string): Promise<{
  hasAccess: boolean;
  isLocked: boolean;
  resource?: typeof resource.$inferSelect;
  unlockFee?: {
    feeAmount: number;
    creditsRequired: number;
    unlockFeeId: string | null;
  };
  error?: string;
}> {
  try {
    // Get the resource
    const resourceData = await db
      .select()
      .from(resource)
      .where(eq(resource.id, resourceId))
      .limit(1)
      .then(res => res[0] || null);

    if (!resourceData) {
      return { hasAccess: false, isLocked: true, error: "Resource not found" };
    }

    // Get unlock fee using single source of truth
    const unlockFeeData = await getResourceUnlockFee(resourceId);
    
    // If no unlock fee exists, the resource is effectively locked
    if (!unlockFeeData.unlockFeeId) {
      return {
        hasAccess: false,
        isLocked: true,
        resource: resourceData,
      };
    }

    // Check if user has unlocked this content
    const unlockedRecord = await db
      .select()
      .from(unlockedContent)
      .where(and(
        eq(unlockedContent.userId, dbUserId),
        eq(unlockedContent.unlockFeeId, unlockFeeData.unlockFeeId)
      ))
      .limit(1)
      .then(res => res[0] || null);

    if (unlockedRecord) {
      return {
        hasAccess: true,
        isLocked: false,
        resource: resourceData,
        unlockFee: unlockFeeData,
      };
    }

    // User has not unlocked - deny access
    return {
      hasAccess: false,
      isLocked: true,
      resource: resourceData,
      unlockFee: unlockFeeData,
    };

  } catch (error) {
    console.error("Resource access check error:", error);
    return { hasAccess: false, isLocked: true, error: "Failed to check resource access" };
  }
}

/**
 * API Route to serve protected resources
 * Only serves content if the user has unlocked it
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

    const { searchParams } = new URL(req.url);
    const resourceId = searchParams.get("resourceId");

    if (!resourceId) {
      return NextResponse.json(
        { error: "Resource ID is required" },
        { status: 400 }
      );
    }

    // Check resource access using database user ID
    const access = await checkResourceAccess(userData.id, resourceId);

    if (access.error) {
      return NextResponse.json(
        { error: access.error },
        { status: access.error === "Resource not found" ? 404 : 500 }
      );
    }

    if (!access.hasAccess) {
      return NextResponse.json(
        { 
          error: "This content is locked. Please unlock it to access.",
          isLocked: true,
          unlockFee: access.unlockFee ? {
            creditsRequired: access.unlockFee.creditsRequired,
            feeAmount: access.unlockFee.feeAmount,
          } : undefined,
        },
        { status: 403 }
      );
    }

    // User has access - return resource details (not the actual file content)
    // The actual file content should be served via a separate endpoint or CDN
    return NextResponse.json({
      hasAccess: true,
      resource: {
        id: access.resource!.id,
        title: access.resource!.title,
        type: access.resource!.type,
        description: access.resource!.description,
        url: access.resource!.url,
        thumbnailUrl: access.resource!.thumbnailUrl,
      },
    });

  } catch (error) {
    console.error("Protected resource access error:", error);
    return NextResponse.json(
      { error: "Failed to access resource" },
      { status: 500 }
    );
  }
}
