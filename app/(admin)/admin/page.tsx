import { getGradesFullHierarchy } from "@/lib/actions/admin";
import { UnifiedAdminPageClient } from "@/components/admin/unified-admin-page-client";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const grades = await getGradesFullHierarchy();

  return <UnifiedAdminPageClient initialGrades={grades} />;
}
