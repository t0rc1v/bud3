import { getLevelsForUser } from "@/lib/actions/admin";
import { UnifiedAdminPageClient } from "@/components/admin/unified-admin-page-client";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId } from "@/lib/actions/auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    redirect("/sign-in");
  }

  const user = await getUserByClerkId(clerkId);

  if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
    redirect("/");
  }

  // Get levels filtered by ownership - admins only see their own content + super-admin content
  const levels = await getLevelsForUser(user.id, user.role);

  return <UnifiedAdminPageClient initialLevels={levels} userId={user.id} userRole={user.role} />;
}
