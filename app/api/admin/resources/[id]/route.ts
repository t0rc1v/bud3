import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { resource, unlockFee } from "@/lib/db/schema";

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

    const { id: resourceId } = await params;

    if (!resourceId) {
      return NextResponse.json(
        { error: "Resource ID is required" },
        { status: 400 }
      );
    }

    const resourceData = await db.query.resource.findFirst({
      where: eq(resource.id, resourceId),
    });

    if (!resourceData) {
      return NextResponse.json(
        { error: "Resource not found" },
        { status: 404 }
      );
    }

    // Get unlock fee if exists
    const unlockFeeData = await db.query.unlockFee.findFirst({
      where: and(
        eq(unlockFee.resourceId, resourceId),
        eq(unlockFee.isActive, true)
      ),
    });

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
