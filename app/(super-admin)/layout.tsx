import { type ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId } from "@/lib/actions/auth";
import { getLevelsFullHierarchy } from "@/lib/actions/admin";
import { SuperAdminLayoutClient } from "@/components/super-admin/super-admin-layout-client";

export default async function SuperAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    redirect("/sign-in");
  }

  const user = await getUserByClerkId(clerkId);

  // Only super_admin can access super admin pages
  if (!user || user.role !== "super_admin") {
    redirect("/admin");
  }

  // Fetch levels for the sidebar content tree
  const levels = await getLevelsFullHierarchy();

  return (
    <SuperAdminLayoutClient 
      userId={user.clerkId}
      dbUserId={user.id}
      initialLevels={levels}
    >
      {children}
    </SuperAdminLayoutClient>
  );
}
