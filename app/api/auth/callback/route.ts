import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId, hasUserCompletedOnboarding } from "@/lib/actions/auth";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await getUserByClerkId(userId);

  // If user doesn't exist in database, redirect to onboarding
  if (!user) {
    redirect("/onboarding");
  }

  // If user hasn't completed onboarding, redirect them there
  const hasCompletedOnboarding = await hasUserCompletedOnboarding(userId);
  if (!hasCompletedOnboarding) {
    redirect("/onboarding");
  }

  // Redirect based on role (no verification needed)
  if (user.role === "super_admin") {
    redirect("/super-admin");
  } else if (user.role === "admin") {
    redirect("/admin");
  } else if (user.role === "regular") {
    redirect("/regular/dashboard");
  }

  // Fallback
  redirect("/");
}
