import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId } from "@/lib/actions/auth";
import { getMyLearnersPaginated } from "@/lib/actions/admin";
import { AdminManageRegularsClient } from "@/components/admin/manage-regulars-client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export default async function AdminRegularsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const currentUser = await getUserByClerkId(userId);

  if (!currentUser || currentUser.role !== "admin") {
    redirect("/admin");
  }

  const initialData = await getMyLearnersPaginated(currentUser.id, 1, PAGE_SIZE);

  return (
    <AdminManageRegularsClient adminId={currentUser.id} initialData={initialData} />
  );
}
