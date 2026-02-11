import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { checkUserPermission, ensureAdminPermissions } from "@/lib/actions/admin-permissions";
import { FinancePermissions } from "@/lib/permissions";
import { getUserByClerkId } from "@/lib/actions/auth";
import ManageUnlockFeesClient from "@/components/admin/manage-unlock-fees-client";

export const dynamic = "force-dynamic";

export default async function AdminManageUnlockFeesPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Only admin role can access this page
  const userData = await getUserByClerkId(userId);

  if (!userData || userData.role !== "admin") {
    // Redirect super_admin to their own manage-unlock-fees page
    if (userData?.role === "super_admin") {
      redirect("/super-admin/manage-unlock-fees");
    }
    redirect("/");
  }

  // Ensure admin has default permissions
  await ensureAdminPermissions(userId);

  // Check if admin has permission to manage unlock fees for their own content
  const hasPermission = await checkUserPermission(userId, FinancePermissions.UNLOCK_FEE_MANAGE);

  if (!hasPermission) {
    redirect("/admin");
  }

  return (
    <div className="container mx-auto py-6">
      <ManageUnlockFeesClient 
        userRole="admin"
        userId={userData.id}
        dbUserId={userData.id}
      />
    </div>
  );
}
