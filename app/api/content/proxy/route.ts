import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { resource, unlockFee, unlockedContent, user } from "@/lib/db/schema";

/**
 * GET /api/content/proxy?resourceId={id}
 * Secure content proxy that verifies access before streaming content
 * Prevents direct URL access to locked resources
 */
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

    // Get the resource details
    const resourceData = await db.query.resource.findFirst({
      where: eq(resource.id, resourceId),
    });

    if (!resourceData) {
      return NextResponse.json(
        { error: "Resource not found" },
        { status: 404 }
      );
    }

    // Check for unlock fee
    const unlockFeeRecord = await db.query.unlockFee.findFirst({
      where: and(
        eq(unlockFee.resourceId, resourceId),
        eq(unlockFee.isActive, true)
      ),
    });

    // If there's an unlock fee, verify the user has unlocked it
    if (unlockFeeRecord) {
      const unlockedRecord = await db.query.unlockedContent.findFirst({
        where: and(
          eq(unlockedContent.userId, userId),
          eq(unlockedContent.unlockFeeId, unlockFeeRecord.id)
        ),
      });

      if (!unlockedRecord) {
        return NextResponse.json(
          { 
            error: "This content is locked. Please unlock it to access.",
            isLocked: true,
            unlockFee: {
              feeAmount: unlockFeeRecord.feeAmount,
              creditsRequired: unlockFeeRecord.creditsRequired,
            }
          },
          { status: 403 }
        );
      }
    }

    // User has access - proxy the content
    if (!resourceData.url) {
      return NextResponse.json(
        { error: "Resource URL not available" },
        { status: 404 }
      );
    }

    try {
      // Fetch the content from the original URL
      const contentResponse = await fetch(resourceData.url);
      
      if (!contentResponse.ok) {
        return NextResponse.json(
          { error: "Failed to fetch content" },
          { status: 502 }
        );
      }

      // Get the content type
      const contentType = contentResponse.headers.get("content-type") || "application/octet-stream";
      
      // Stream the content back with security headers
      const headers = new Headers();
      headers.set("Content-Type", contentType);
      headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
      headers.set("Pragma", "no-cache");
      headers.set("Expires", "0");
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("X-Frame-Options", "SAMEORIGIN");
      
      // Copy content-disposition if present
      const contentDisposition = contentResponse.headers.get("content-disposition");
      if (contentDisposition) {
        headers.set("Content-Disposition", contentDisposition);
      }

      return new Response(contentResponse.body, {
        status: 200,
        headers,
      });
    } catch (fetchError) {
      console.error("Error fetching content:", fetchError);
      return NextResponse.json(
        { error: "Failed to retrieve content" },
        { status: 502 }
      );
    }

  } catch (error) {
    console.error("Content proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
