import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId } from "@/lib/actions/auth";
import { SuperAdminRewardsManager } from "@/components/super-admin/rewards-manager";

export const dynamic = "force-dynamic";

export default async function SuperAdminRewardsPage() {
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
      <SuperAdminRewardsManager />
    </div>
  );
}
