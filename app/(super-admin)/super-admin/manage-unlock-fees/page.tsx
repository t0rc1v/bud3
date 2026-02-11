import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId } from "@/lib/actions/auth";
import ManageUnlockFeesClient from "@/components/admin/manage-unlock-fees-client";

export const dynamic = "force-dynamic";

export default async function SuperAdminManageUnlockFeesPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Only super_admin can access this page
  const userData = await getUserByClerkId(userId);

  if (!userData || userData.role !== "super_admin") {
    redirect("/admin");
  }

  return (
    <div className="container mx-auto py-6">
      <ManageUnlockFeesClient 
        userRole="super_admin"
        userId={userData.id}
        dbUserId={userData.id}
      />
    </div>
  );
}
