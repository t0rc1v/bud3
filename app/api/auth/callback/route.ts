import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId } from "@/lib/actions/auth";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await getUserByClerkId(userId);

  // If user doesn't exist in database or needs onboarding
  if (!user) {
    redirect("/onboarding");
  }

  // Redirect based on role
  if (user.role === "teacher") {
    redirect("/teacher/dashboard");
  } else if (user.role === "learner") {
    redirect("/learner/dashboard");
  } else if (user.role === "admin") {
    redirect("/admin");
  }

  // Fallback
  redirect("/");
}
