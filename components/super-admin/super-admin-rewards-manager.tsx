"use client";

import { AdminRewardsManager } from "@/components/admin/admin-rewards-manager";

export function SuperAdminRewardsManager() {
  return <AdminRewardsManager userRole="super_admin" hasCreditReward={true} />;
}
