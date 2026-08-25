import AdminClient from "@/components/AdminClient";
import AdminForbidden from "@/components/admin/AdminForbidden";
import { requireAdminUser } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminHeroPage() {
  const user = await requireAdminUser();

  if (!user.is_admin) {
    return <AdminForbidden />;
  }

  return (
    <div className="py-4 lg:py-2">
      <AdminClient user={user} initialTab="hero" singleTab />
    </div>
  );
}
