import { getGradesFullHierarchy, getAllUsers, getSystemStats } from "@/lib/actions/admin";
import { SuperAdminDashboardClient } from "@/components/super-admin/super-admin-dashboard-client";

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  const [grades, users, stats] = await Promise.all([
    getGradesFullHierarchy(),
    getAllUsers(),
    getSystemStats(),
  ]);

  return (
    <SuperAdminDashboardClient 
      initialGrades={grades} 
      initialUsers={users}
      initialStats={stats}
    />
  );
}
