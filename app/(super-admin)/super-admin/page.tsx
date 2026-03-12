import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId } from "@/lib/actions/auth";
import { getLevelsFullHierarchy, getAllUsers, getSuperAdminScopedStats } from "@/lib/actions/admin";
import { SuperAdminDashboardClient } from "@/components/super-admin/super-admin-dashboard-client";

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    redirect("/sign-in");
  }

  const user = await getUserByClerkId(clerkId);

  if (!user || user.role !== "super_admin") {
    redirect("/admin");
  }

  const [levels, users, stats] = await Promise.all([
    getLevelsFullHierarchy(),
    getAllUsers(),
    getSuperAdminScopedStats(user.id),
  ]);

  return (
    <SuperAdminDashboardClient
      initialLevels={levels}
      initialUsers={users}
      initialStats={stats}
      currentUserId={user.id}
    />
  );
}
