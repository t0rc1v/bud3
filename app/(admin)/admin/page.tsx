import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId } from "@/lib/actions/auth";
import { getLevelsForUser } from "@/lib/actions/admin";
import { AdminDashboardClient } from "@/components/admin/admin-dashboard-client";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await getUserByClerkId(userId);

  if (!user || user.role !== "admin") {
    if (user?.role === "super_admin") {
      redirect("/super-admin");
    }
    redirect("/");
  }

  const levels = await getLevelsForUser(user.id, user.role);

  return (
    <AdminDashboardClient
      initialLevels={levels} 
      userId={user.id} 
      userRole={user.role} 
    />
  );
}
