import { type ReactNode } from "react";
import { ContentLayoutClient } from "@/app/(content)/content-layout-client";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId, hasUserCompletedOnboarding } from "@/lib/actions/auth";
import { getGradesForUser, getRegularAdminIds } from "@/lib/actions/admin";

export default async function RegularLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await getUserByClerkId(userId);
  const hasCompletedOnboarding = await hasUserCompletedOnboarding(userId);

  // If user hasn't completed onboarding, redirect them there
  if (!hasCompletedOnboarding) {
    redirect("/onboarding");
  }

  if (!user || user.role !== "regular") {
    redirect("/");
  }

  // Fetch grades and admin IDs for the sidebar content tree
  const [grades, adminIds] = await Promise.all([
    getGradesForUser(user.id, user.role),
    getRegularAdminIds(user.id),
  ]);

  return (
    <ContentLayoutClient 
      userId={user.clerkId} 
      dbUserId={user.id} 
      userRole="regular"
      initialGrades={grades}
      adminIds={adminIds}
    >
      {children}
    </ContentLayoutClient>
  );
}
