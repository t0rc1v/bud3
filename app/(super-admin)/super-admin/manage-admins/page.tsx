import { getAllAdmins, getAllRoles } from "@/lib/actions/admin-permissions";
import { getAllUsers } from "@/lib/actions/admin";
import { ManageAdminsClient } from "@/components/admin/manage-admins-client";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId } from "@/lib/actions/auth";

export const dynamic = "force-dynamic";

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

  const [admins, roles, allUsers] = await Promise.all([
    getAllAdmins(),
    getAllRoles(),
    getAllUsers(),
  ]);

  // Filter to get only regular users (for promotion search)
  const regularUsers = allUsers.filter(user => user.role === "regular");

  return (
    <ManageAdminsClient 
      admins={admins} 
      roles={roles}
      currentUserId={currentUser.id}
      regularUsers={regularUsers}
    />
  );
}
