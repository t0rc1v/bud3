import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId } from "@/lib/actions/auth";
import { ReportsClient } from "@/components/admin/reports-client";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const userData = await getUserByClerkId(userId);

  if (!userData || userData.role !== "admin") {
    if (userData?.role === "super_admin") {
      redirect("/super-admin/reports");
    }
    redirect("/");
  }

  return (
    <div className="container mx-auto py-6">
      <ReportsClient />
    </div>
  );
}
