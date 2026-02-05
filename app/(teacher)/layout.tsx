import { type ReactNode } from "react";
import { ContentLayoutClient } from "@/app/(content)/content-layout-client";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId } from "@/lib/actions/auth";

export default async function TeacherLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await getUserByClerkId(userId);

  if (!user || user.role !== "teacher") {
    redirect("/");
  }

  return (
    <ContentLayoutClient userId={userId} userRole="teacher">
      {children}
    </ContentLayoutClient>
  );
}
