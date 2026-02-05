import { getAllAdmins, getAllRoles } from "@/lib/actions/admin-permissions";
import { ManageAdminsClient } from "@/components/admin/manage-admins-client";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId } from "@/lib/actions/auth";

export default async function ManageAdminsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const currentUser = await getUserByClerkId(userId);

  // Only super admin can access this page
  if (!currentUser || currentUser.role !== "super_admin") {
    redirect("/admin");
  }

  const admins = await getAllAdmins();
  const roles = await getAllRoles();

  return (
    <ManageAdminsClient 
      admins={admins} 
      roles={roles}
      currentUserId={currentUser.id}
    />
  );
}
