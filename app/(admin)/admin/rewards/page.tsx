import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { checkUserPermission, ensureAdminPermissions } from "@/lib/actions/admin-permissions";
import { RewardPermissions } from "@/lib/permissions";
import { RewardsManager } from "@/components/admin/rewards-manager";
import { getUserByClerkId } from "@/lib/actions/auth";

export const dynamic = "force-dynamic";

export default async function AdminRewardsPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/sign-in");
  }

  // Only admin role can access this page
  const userData = await getUserByClerkId(userId);

  if (!userData || userData.role !== "admin") {
    // Redirect super_admin to their own rewards page
    if (userData?.role === "super_admin") {
      redirect("/super-admin/rewards");
    }
    redirect("/");
  }

  // Ensure admin has default permissions
  await ensureAdminPermissions(userId);

  // Check if admin has credit_reward permission for their own content
  const hasCreditReward = await checkUserPermission(userId, RewardPermissions.CREDIT_REWARD);

  if (!hasCreditReward) {
    redirect("/admin");
  }

  return (
    <div className="container mx-auto py-6">
      <RewardsManager 
        userRole="admin" 
        hasCreditReward={hasCreditReward}
      />
    </div>
  );
}
