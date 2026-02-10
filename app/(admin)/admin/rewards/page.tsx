import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { checkUserPermission } from "@/lib/actions/admin-permissions";
import { RewardPermissions } from "@/lib/permissions";
import { RewardsManager } from "@/components/admin/rewards-manager";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { user } from "@/lib/db/schema";

export default async function RewardsPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/sign-in");
  }

  // Check if user is super_admin or has credit_reward permission
  const userData = await db.query.user.findFirst({
    where: eq(user.userId, userId),
  });

  const isSuperAdmin = userData?.role === "super_admin";
  const hasCreditReward = isSuperAdmin || await checkUserPermission(userId, RewardPermissions.CREDIT_REWARD);

  if (!hasCreditReward) {
    redirect("/admin");
  }

  return (
    <div className="container mx-auto py-6">
      <RewardsManager 
        userRole={userData?.role as "super_admin" | "admin"} 
        hasCreditReward={hasCreditReward}
      />
    </div>
  );
}
