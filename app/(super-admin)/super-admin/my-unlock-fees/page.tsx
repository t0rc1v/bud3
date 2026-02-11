import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MyUnlockFeesRedirectPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Redirect to the shared manage-unlock-fees page with my-content filter
  redirect("/admin/manage-unlock-fees");
}
