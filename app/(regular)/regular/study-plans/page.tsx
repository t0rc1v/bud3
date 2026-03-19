import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId } from "@/lib/actions/auth";
import { StudyPlansClient } from "@/components/regular/study-plans-client";

export const dynamic = "force-dynamic";

export default async function StudyPlansPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await getUserByClerkId(userId);

  if (!user || user.role !== "regular") {
    redirect("/");
  }

  return <StudyPlansClient />;
}
