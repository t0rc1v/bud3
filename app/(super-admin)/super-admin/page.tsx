import { getLevelsFullHierarchy, getAllUsers, getSystemStats } from "@/lib/actions/admin";
import { SuperAdminDashboardClient } from "@/components/super-admin/super-admin-dashboard-client";

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  const [levels, users, stats] = await Promise.all([
    getLevelsFullHierarchy(),
    getAllUsers(),
    getSystemStats(),
  ]);

  return (
    <SuperAdminDashboardClient 
      initialLevels={levels} 
      initialUsers={users}
      initialStats={stats}
    />
  );
}
