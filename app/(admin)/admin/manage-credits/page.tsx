import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default function ManageCreditsRedirectPage() {
  // Redirect to the new rewards page
  redirect("/admin/rewards");
}
