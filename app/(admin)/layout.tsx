import { type ReactNode } from "react";
import { AdminLayoutClient } from "./admin-layout-client";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <AdminLayoutClient userId={userId}>{children}</AdminLayoutClient>;
}
