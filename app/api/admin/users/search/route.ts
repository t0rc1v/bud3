import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { user } from "@/lib/db/schema";
import { checkUserPermission } from "@/lib/actions/admin-permissions";
import { UserPermissions } from "@/lib/permissions";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const hasPermission = await checkUserPermission(userId, UserPermissions.USERS_READ);
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limit: 30 searches per minute per user
    const rateLimit = checkRateLimit(`user-search:${userId}`, 30, 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before searching again." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
        }
      );
    }

    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "Email parameter is required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const foundUser = await db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1)
      .then(res => res[0] || null);

    if (!foundUser) {
      // Return 200 with null user to prevent email enumeration
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        userId: foundUser.clerkId,
        email: foundUser.email,
        name: foundUser.name ?? foundUser.email.split('@')[0],
        role: foundUser.role,
      },
    });

  } catch (error) {
    console.error("User search error:", error);
    return NextResponse.json(
      { error: "Failed to search for user" },
      { status: 500 }
    );
  }
}
