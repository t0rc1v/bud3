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

  // Redirect based on role
  if (user.role === "teacher") {
    redirect("/teacher/dashboard");
  } else if (user.role === "learner") {
    redirect("/learner/dashboard");
  } else if (user.role === "admin" || user.role === "super_admin") {
    redirect("/admin");
  }

  // Fallback
  redirect("/");
}
