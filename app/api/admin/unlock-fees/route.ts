import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { unlockFee, resource, topic, subject, grade } from "@/lib/db/schema";
import { checkUserPermission } from "@/lib/actions/admin-permissions";
import { ContentPermissions } from "@/lib/permissions";

/**
 * GET /api/admin/unlock-fees
 * Get all unlock fees with content details
 */
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check permission - use RESOURCES_UPDATE for managing resource unlock fees
    const hasPermission = await checkUserPermission(userId, ContentPermissions.RESOURCES_UPDATE);
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Forbidden - You don't have permission to manage unlock fees" },
        { status: 403 }
      );
    }

    // Get all unlock fees with related content
    const fees = await db.query.unlockFee.findMany({
      orderBy: (unlockFee, { desc }) => [desc(unlockFee.createdAt)],
      with: {
        resource: {
          with: {
            topic: {
              with: {
                subject: {
                  with: {
                    grade: true,
                  },
                },
              },
            },
          },
        },
        topic: {
          with: {
            subject: {
              with: {
                grade: true,
              },
            },
          },
        },
        subject: {
          with: {
            grade: true,
          },
        },
      },
    });

    return NextResponse.json({ fees });

  } catch (error) {
    console.error("Get unlock fees error:", error);
    return NextResponse.json(
      { error: "Failed to get unlock fees" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/unlock-fees
 * Update an unlock fee
 */
export async function PUT(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check permission - use RESOURCES_UPDATE for managing resource unlock fees
    const hasPermission = await checkUserPermission(userId, ContentPermissions.RESOURCES_UPDATE);
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Forbidden - You don't have permission to manage unlock fees" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { feeId, feeAmount, isActive } = body;

    if (!feeId) {
      return NextResponse.json(
        { error: "Fee ID is required" },
        { status: 400 }
      );
    }

    // Validate fee amount
    if (feeAmount !== undefined && (typeof feeAmount !== "number" || feeAmount < 1)) {
      return NextResponse.json(
        { error: "Fee amount must be at least 1 Ksh" },
        { status: 400 }
      );
    }

    // Update the unlock fee
    await db
      .update(unlockFee)
      .set({
        ...(feeAmount !== undefined && { feeAmount }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date(),
      })
      .where(eq(unlockFee.id, feeId));

    return NextResponse.json({
      success: true,
      message: "Unlock fee updated successfully",
    });

  } catch (error) {
    console.error("Update unlock fee error:", error);
    return NextResponse.json(
      { error: "Failed to update unlock fee" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/unlock-fees
 * Create a new unlock fee (bulk creation for resources)
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin or has content management permission
    const hasPermission = await checkUserPermission(userId, ContentPermissions.RESOURCES_UPDATE);
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Forbidden - You don't have permission to create unlock fees" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { resourceId, topicId, subjectId, feeAmount, isActive = true } = body;

    // Validate that at least one content ID is provided
    if (!resourceId && !topicId && !subjectId) {
      return NextResponse.json(
        { error: "Resource ID, Topic ID, or Subject ID is required" },
        { status: 400 }
      );
    }

    // Determine the type
    let type: "resource" | "topic" | "subject";
    if (resourceId) type = "resource";
    else if (topicId) type = "topic";
    else type = "subject";

    // Check if unlock fee already exists
    const existingFee = await db.query.unlockFee.findFirst({
      where: and(
        type === "resource" ? eq(unlockFee.resourceId, resourceId!) :
        type === "topic" ? eq(unlockFee.topicId, topicId!) :
        eq(unlockFee.subjectId, subjectId!),
        eq(unlockFee.type, type)
      ),
    });

    if (existingFee) {
      return NextResponse.json(
        { error: "Unlock fee already exists for this content" },
        { status: 409 }
      );
    }

    // Create the unlock fee
    const [newFee] = await db
      .insert(unlockFee)
      .values({
        type,
        resourceId: resourceId || null,
        topicId: topicId || null,
        subjectId: subjectId || null,
        feeAmount: feeAmount || 100,
        creditsRequired: 0, // Not used anymore, but required by schema
        isActive,
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: "Unlock fee created successfully",
      fee: newFee,
    });

  } catch (error) {
    console.error("Create unlock fee error:", error);
    return NextResponse.json(
      { error: "Failed to create unlock fee" },
      { status: 500 }
    );
  }
}
