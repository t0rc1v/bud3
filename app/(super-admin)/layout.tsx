import { type ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId } from "@/lib/actions/auth";
import { getLevelsFullHierarchy, getAllUsers, getSystemStats } from "@/lib/actions/admin";
import { SuperAdminLayoutClient } from "@/components/super-admin/super-admin-layout-client";
import { SuperAdminDashboardClient } from "@/components/super-admin/super-admin-dashboard-client";

export default async function SuperAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    redirect("/sign-in");
  }

  const user = await getUserByClerkId(clerkId);

  // Only super_admin can access super admin pages
  if (!user || user.role !== "super_admin") {
    redirect("/admin");
  }

  // Fetch data for both sidebar and dashboard
  const [levels, users, stats] = await Promise.all([
    getLevelsFullHierarchy(),
    getAllUsers(),
    getSystemStats(),
  ]);

  return (
    <SuperAdminLayoutClient 
      userId={user.id}
      dbUserId={user.id}
      initialLevels={levels}
    >
      <SuperAdminDashboardClient 
        initialLevels={levels} 
        initialUsers={users}
        initialStats={stats}
      />
    </SuperAdminLayoutClient>
  );
}
