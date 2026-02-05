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

  // Allow both admin and super_admin to access admin pages
  if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
    redirect("/");
  }

  return (
    <AdminLayoutClient 
      userId={userId} 
      userRole={user.role}
    >
      {children}
    </AdminLayoutClient>
  );
}
