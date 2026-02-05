import { getGradesFullHierarchy } from "@/lib/actions/teacher";
import { UnifiedLearnerPageClient } from "@/components/learner/unified-learner-page-client";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId } from "@/lib/actions/auth";

export default async function LearnerPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await getUserByClerkId(userId);

  if (!user || user.role !== "learner") {
    redirect("/");
  }

  const grades = await getGradesFullHierarchy();

  return <UnifiedLearnerPageClient initialGrades={grades} />;
}
