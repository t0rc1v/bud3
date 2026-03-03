import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { resource, unlockFee } from "@/lib/db/schema";
import { checkUserPermission } from "@/lib/actions/admin-permissions";
import { ContentPermissions } from "@/lib/permissions";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const hasPermission = await checkUserPermission(userId, ContentPermissions.RESOURCES_READ);
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const { id: resourceId } = await params;

    if (!resourceId) {
      return NextResponse.json(
        { error: "Resource ID is required" },
        { status: 400 }
      );
    }

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

    // Get unlock fee if exists
    const unlockFeeData = await db
      .select()
      .from(unlockFee)
      .where(and(
        eq(unlockFee.resourceId, resourceId),
        eq(unlockFee.isActive, true)
      ))
      .limit(1)
      .then(res => res[0] || null);

    return NextResponse.json({
      resource: {
        id: resourceData.id,
        title: resourceData.title,
        type: resourceData.type,
        unlockFee: unlockFeeData?.creditsRequired || 50,
      },
    });

  } catch (error) {
    console.error("Resource fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch resource" },
      { status: 500 }
    );
  }
}
