import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkUserPermission } from "@/lib/actions/admin-permissions";
import { UserPermissions } from "@/lib/permissions";
import { getUserByClerkId } from "@/lib/actions/auth";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getLevelsForUser } from "@/lib/actions/admin";
import { logAudit } from "@/lib/audit";

/**
 * GET /api/admin/impersonate?userId=<db-uuid>
 * Returns the content hierarchy and credit balance as seen by the target user.
 * Requires USERS_IMPERSONATE permission (super_admin only by default).
 * Does NOT create a real session for the target user.
 */
export async function GET(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasPermission = await checkUserPermission(clerkId, UserPermissions.USERS_IMPERSONATE);
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const actor = await getUserByClerkId(clerkId);
    if (!actor) {
      return NextResponse.json({ error: "Actor not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId");
    if (!targetUserId || !/^[0-9a-f-]{36}$/.test(targetUserId)) {
      return NextResponse.json({ error: "Valid userId is required" }, { status: 400 });
    }

    // Fetch target user
    const targetUser = await db
      .select({ id: user.id, email: user.email, role: user.role, name: user.name })
      .from(user)
      .where(eq(user.id, targetUserId))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!targetUser) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }

    // Super-admins can only impersonate regulars and admins, not other super-admins
    if (targetUser.role === "super_admin") {
      return NextResponse.json({ error: "Cannot impersonate another super-admin" }, { status: 403 });
    }

    // Fetch content as the target user would see it
    const levels = await getLevelsForUser(targetUserId, targetUser.role);

    await logAudit(actor.id, "user.impersonated", "user", targetUserId, {
      actorEmail: actor.email,
      targetEmail: targetUser.email,
    });

    return NextResponse.json({
      targetUser: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role,
      },
      levels,
    });
  } catch (error) {
    console.error("Impersonation error:", error);
    return NextResponse.json({ error: "Failed to load impersonation view" }, { status: 500 });
  }
}
