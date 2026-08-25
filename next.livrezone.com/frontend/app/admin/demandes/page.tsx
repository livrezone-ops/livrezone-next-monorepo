import AdminDemandesClient from "@/components/admin/AdminDemandesClient";
import AdminForbidden from "@/components/admin/AdminForbidden";
import { requireAdminUser } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminDemandesPage() {
  const user = await requireAdminUser();

  if (!user.is_admin) {
    return <AdminForbidden />;
  }

  return (
    <div className="py-4 lg:py-2">
      <AdminDemandesClient />
    </div>
  );
}
