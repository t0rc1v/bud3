import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId } from "@/lib/actions/auth";
import { AdminAnalyticsClient } from "@/components/admin/admin-analytics-client";

export const dynamic = "force-dynamic";

export default async function SuperAdminAiAnalyticsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const userData = await getUserByClerkId(userId);

  if (!userData || userData.role !== "super_admin") {
    redirect("/");
  }

  return (
    <div className="container mx-auto py-6">
      <AdminAnalyticsClient />
    </div>
  );
}
