import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId, getAllAdmins } from "@/lib/actions/auth";
import { ManageAdminsClient } from "@/components/admin/manage-admins-client";

export default async function ManageAdminsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await getUserByClerkId(userId);

  // Only super_admin can access this page
  if (!user || user.role !== "super_admin") {
    redirect("/admin");
  }

  const admins = await getAllAdmins();

  return <ManageAdminsClient admins={admins} />;
}
