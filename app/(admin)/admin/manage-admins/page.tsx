import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId } from "@/lib/actions/auth";

export const dynamic = "force-dynamic";

export default async function ManageAdminsRedirectPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const currentUser = await getUserByClerkId(userId);

  // Only super admin can access manage-admins, redirect them to the new location
  if (!currentUser || currentUser.role !== "super_admin") {
    redirect("/admin");
  }

  // Redirect super admins to the new location
  redirect("/super-admin/manage-admins");
}
