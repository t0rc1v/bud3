import { type ReactNode } from "react";
import { RegularLayoutClient } from "@/components/regular/regular-layout-client";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId, hasUserCompletedOnboarding } from "@/lib/actions/auth";
import { getLevelsForUser, getRegularAdminIds } from "@/lib/actions/admin";

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

  // Fetch levels and admin IDs for the sidebar content tree
  const [levels, adminIds] = await Promise.all([
    getLevelsForUser(user.id, user.role),
    getRegularAdminIds(user.id),
  ]);

  return (
    <RegularLayoutClient
      userId={user.id} 
      dbUserId={user.id} 
      userRole="regular"
      initialLevels={levels}
      adminIds={adminIds}
    >
      {children}
    </RegularLayoutClient>
  );
}
