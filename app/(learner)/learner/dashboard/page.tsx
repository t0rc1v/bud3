import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId } from "@/lib/actions/auth";
import { UnifiedLearnerPageClient } from "@/components/learner/unified-learner-page-client";

export const dynamic = "force-dynamic";

export default async function LearnerDashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await getUserByClerkId(userId);

  if (!user || user.role !== "learner") {
    redirect("/");
  }

  // Pass empty initial grades - the client will fetch actual data with unlock status
  return <UnifiedLearnerPageClient initialGrades={[]} />;
}
