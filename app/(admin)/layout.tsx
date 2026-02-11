import { type ReactNode } from "react";
import { AdminLayoutClient } from "./admin-layout-client";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId } from "@/lib/actions/auth";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await getUserByClerkId(userId);

  // Only admin role can access admin pages (super_admin has separate dashboard)
  if (!user || user.role !== "admin") {
    // Redirect super_admin to their own dashboard
    if (user?.role === "super_admin") {
      redirect("/super-admin");
    }
    redirect("/");
  }

  return (
    <AdminLayoutClient 
      userId={user.clerkId}
      dbUserId={user.id}
      userRole={user.role}
    >
      {children}
    </AdminLayoutClient>
  );
}
