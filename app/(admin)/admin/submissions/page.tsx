import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId } from "@/lib/actions/auth";
import { AdminSubmissionsClient } from "@/components/admin/admin-submissions-client";

export const dynamic = "force-dynamic";

export default async function AdminSubmissionsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const userData = await getUserByClerkId(userId);

  if (!userData || userData.role !== "admin") {
    if (userData?.role === "super_admin") {
      redirect("/super-admin/submissions");
    }
    redirect("/");
  }

  return (
    <div className="container mx-auto py-6">
      <AdminSubmissionsClient />
    </div>
  );
}
