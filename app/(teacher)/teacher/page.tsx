import { getGradesFullHierarchy, getMyLearners } from "@/lib/actions/teacher";
import { UnifiedTeacherPageClient } from "@/components/teacher/unified-teacher-page-client";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId } from "@/lib/actions/auth";

export const dynamic = "force-dynamic";

export default async function TeacherPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await getUserByClerkId(userId);

  if (!user || user.role !== "teacher") {
    redirect("/");
  }

  const grades = await getGradesFullHierarchy();
  const myLearners = await getMyLearners(user.id);

  return (
    <UnifiedTeacherPageClient 
      initialGrades={grades} 
      teacherId={user.id}
      myLearners={myLearners}
    />
  );
}
