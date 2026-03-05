import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId } from "@/lib/actions/auth";
import { getSuperAdminRegularsPaginated } from "@/lib/actions/super-admin";
import { ManageRegularsClient } from "@/components/super-admin/manage-regulars-client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export default async function SuperAdminRegularsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const currentUser = await getUserByClerkId(userId);

  if (!currentUser || currentUser.role !== "super_admin") {
    redirect("/super-admin");
  }

  const initialData = await getSuperAdminRegularsPaginated(currentUser.id, 1, PAGE_SIZE);

  return (
    <ManageRegularsClient
      superAdminId={currentUser.id}
      initialData={initialData}
    />
  );
}
