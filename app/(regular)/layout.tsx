import { type ReactNode } from "react";
import { ContentLayoutClient } from "@/app/(content)/content-layout-client";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId, hasUserCompletedOnboarding } from "@/lib/actions/auth";

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

  return (
    <ContentLayoutClient userId={user.clerkId} dbUserId={user.id} userRole="regular">
      {children}
    </ContentLayoutClient>
  );
}
