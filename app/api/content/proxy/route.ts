import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { resource, user } from "@/lib/db/schema";

/**
 * GET /api/content/proxy?resourceId={id}
 * Secure content proxy that verifies access before streaming content
 * Prevents direct URL access to locked resources
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

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(resourceId)) {
      return NextResponse.json(
        { error: "Invalid resource ID format" },
        { status: 400 }
      );
    }

    // Get the resource details
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

      // Whitelist allowed content types — reject anything that could execute in the browser
      const ALLOWED_CONTENT_TYPES = new Set([
        "application/pdf",
        "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
        "video/mp4", "video/webm", "video/ogg",
        "audio/mpeg", "audio/ogg", "audio/wav", "audio/mp4",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ]);

      // Get the content type (strip charset/boundary params for comparison)
      const rawContentType = contentResponse.headers.get("content-type") || "application/octet-stream";
      const contentType = rawContentType.split(";")[0].trim().toLowerCase();

      if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
        console.error(`Proxy blocked disallowed content-type: ${contentType} for resource ${resourceId}`);
        return NextResponse.json(
          { error: "Content type not allowed" },
          { status: 415 }
        );
      }

      // Stream the content back with security headers
      const headers = new Headers();
      headers.set("Content-Type", rawContentType);
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
