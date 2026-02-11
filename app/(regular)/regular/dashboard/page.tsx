import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId } from "@/lib/actions/auth";
import { getGradesForUser, getRegularAdminIds } from "@/lib/actions/admin";
import { RegularDashboardClient } from "@/components/regular/regular-dashboard-client";

export const dynamic = "force-dynamic";

export default async function RegularDashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await getUserByClerkId(userId);

  if (!user || user.role !== "regular") {
    redirect("/");
  }

  // Get grades and admin IDs - same pattern as admin dashboard
  const [grades, adminIds] = await Promise.all([
    getGradesForUser(user.id, user.role),
    getRegularAdminIds(user.id),
  ]);

  return (
    <RegularDashboardClient 
      initialGrades={grades} 
      userId={user.id} 
      adminIds={adminIds}
    />
  );
}
