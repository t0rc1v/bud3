import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { eq, and, inArray, desc } from "drizzle-orm";
import { unlockFee, resource, topic, subject, level } from "@/lib/db/schema";
import { checkUserPermission } from "@/lib/actions/admin-permissions";
import { getUserByClerkId } from "@/lib/actions/auth";
import { FinancePermissions } from "@/lib/permissions";
import { DEFAULT_CREDIT_CONFIG } from "@/lib/mpesa";

/**
 * GET /api/admin/unlock-fees
 * Get all unlock fees with content details
 * Query params:
 * - filter=my-content: Return only fees for content owned by the current user
 */
export async function GET(request: Request) {
  try {
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check permission - use UNLOCK_FEE_MANAGE for managing unlock fees
    const hasPermission = await checkUserPermission(clerkId, FinancePermissions.UNLOCK_FEE_MANAGE);
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Forbidden - You don't have permission to manage unlock fees" },
        { status: 403 }
      );
    }

    // Get the current user to check role and get db user id
    const currentUser = await getUserByClerkId(clerkId);
    if (!currentUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check for filter query param
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter");
    const isMyContentOnly = filter === "my-content";

    // Get all unlock fees with related content using leftJoins
    const feesWithRelations = await db
      .select({
        unlockFee: unlockFee,
        resource: resource,
        resourceTopic: topic,
        resourceSubject: subject,
        resourceLevel: level,
        feeTopic: topic,
        feeSubject: subject,
        feeLevel: level,
        feeSubjectDirect: subject,
        feeLevelDirect: level,
      })
      .from(unlockFee)
      .leftJoin(resource, eq(unlockFee.resourceId, resource.id))
      .leftJoin(topic, eq(resource.topicId, topic.id))
      .leftJoin(subject, eq(topic.subjectId, subject.id))
      .leftJoin(level, eq(subject.levelId, level.id))
      .orderBy(desc(unlockFee.createdAt));

    // Transform the flat result into the nested structure expected by the frontend
    const fees = feesWithRelations.map(({ unlockFee, resource, resourceTopic, resourceSubject, resourceLevel, feeSubjectDirect, feeLevelDirect }) => ({
      ...unlockFee,
      resource: resource ? {
        ...resource,
        topic: resourceTopic ? {
          ...resourceTopic,
          subject: resourceSubject ? {
            ...resourceSubject,
            level: resourceLevel || null,
          } : null,
        } : null,
      } : null,
      topic: unlockFee.topicId ? {
        ...feeSubjectDirect,
        subject: feeLevelDirect ? {
          ...feeLevelDirect,
          level: null, // Would need another join for this
        } : null,
      } : null,
      subject: unlockFee.subjectId ? {
        ...feeSubjectDirect,
        level: feeLevelDirect,
      } : null,
    }));

    // If filtering by my-content and user is not super_admin, filter the results
    if (isMyContentOnly && currentUser.role !== "super_admin") {
      const myFees = fees.filter((fee) => {
        const ownerId = fee.resource?.ownerId || fee.topic?.ownerId || fee.subject?.ownerId;
        return ownerId === currentUser.id;
      });
      return NextResponse.json({ fees: myFees });
    }

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
 * Admins can only update fees for their own content
 * Super admins can update any fee
 */
export async function PUT(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check permission - use UNLOCK_FEE_MANAGE for managing unlock fees
    const hasPermission = await checkUserPermission(clerkId, FinancePermissions.UNLOCK_FEE_MANAGE);
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Forbidden - You don't have permission to manage unlock fees" },
        { status: 403 }
      );
    }

    // Get the current user
    const currentUser = await getUserByClerkId(clerkId);
    if (!currentUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
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

    // Get the unlock fee to check ownership with related content
    const feeWithRelations = await db
      .select({
        unlockFee: unlockFee,
        resource: resource,
        topic: topic,
        subject: subject,
      })
      .from(unlockFee)
      .leftJoin(resource, eq(unlockFee.resourceId, resource.id))
      .leftJoin(topic, eq(unlockFee.topicId, topic.id))
      .leftJoin(subject, eq(unlockFee.subjectId, subject.id))
      .where(eq(unlockFee.id, feeId))
      .limit(1);

    const existingFee = feeWithRelations[0] ? {
      ...feeWithRelations[0].unlockFee,
      resource: feeWithRelations[0].resource,
      topic: feeWithRelations[0].topic,
      subject: feeWithRelations[0].subject,
    } : null;

    if (!existingFee) {
      return NextResponse.json(
        { error: "Unlock fee not found" },
        { status: 404 }
      );
    }

    // Check ownership - admins can only update their own content fees
    if (currentUser.role !== "super_admin") {
      const ownerId = existingFee.resource?.ownerId || 
                      existingFee.topic?.ownerId || 
                      existingFee.subject?.ownerId;
      
      if (ownerId !== currentUser.id) {
        return NextResponse.json(
          { error: "Forbidden - You can only update unlock fees for your own content" },
          { status: 403 }
        );
      }
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
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user has permission to manage unlock fees
    const hasPermission = await checkUserPermission(clerkId, FinancePermissions.UNLOCK_FEE_MANAGE);
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

    // Ownership check: non-super-admins can only create fees for their own content
    const currentUser = await getUserByClerkId(clerkId);
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (currentUser.role !== "super_admin") {
      let contentOwnerId: string | null = null;
      if (type === "resource" && resourceId) {
        const r = await db.select({ ownerId: resource.ownerId }).from(resource)
          .where(eq(resource.id, resourceId)).limit(1).then(rows => rows[0] || null);
        contentOwnerId = r?.ownerId ?? null;
      } else if (type === "topic" && topicId) {
        const t = await db.select({ ownerId: topic.ownerId }).from(topic)
          .where(eq(topic.id, topicId)).limit(1).then(rows => rows[0] || null);
        contentOwnerId = t?.ownerId ?? null;
      } else if (type === "subject" && subjectId) {
        const s = await db.select({ ownerId: subject.ownerId }).from(subject)
          .where(eq(subject.id, subjectId)).limit(1).then(rows => rows[0] || null);
        contentOwnerId = s?.ownerId ?? null;
      }

      if (contentOwnerId !== currentUser.id) {
        return NextResponse.json(
          { error: "Forbidden - You can only create unlock fees for your own content" },
          { status: 403 }
        );
      }
    }

    // Check if unlock fee already exists
    const existingFee = await db
      .select()
      .from(unlockFee)
      .where(and(
        type === "resource" ? eq(unlockFee.resourceId, resourceId!) :
        type === "topic" ? eq(unlockFee.topicId, topicId!) :
        eq(unlockFee.subjectId, subjectId!),
        eq(unlockFee.type, type)
      ))
      .limit(1)
      .then(res => res[0] || null);

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
        feeAmount: feeAmount || DEFAULT_CREDIT_CONFIG.defaultUnlockFeeKes,
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
