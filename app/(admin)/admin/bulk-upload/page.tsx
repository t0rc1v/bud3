import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserByClerkId } from "@/lib/actions/auth";
import { BulkUploadClient } from "@/components/admin/bulk-upload-client";

export const dynamic = "force-dynamic";

export default async function AdminBulkUploadPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const userData = await getUserByClerkId(userId);

  if (!userData || userData.role !== "admin") {
    if (userData?.role === "super_admin") {
      redirect("/super-admin/bulk-upload");
    }
    redirect("/");
  }

  return (
    <div className="container mx-auto py-6">
      <BulkUploadClient />
    </div>
  );
}
