import AdminUserDetailClient from "@/components/admin/AdminUserDetailClient";
import AdminForbidden from "@/components/admin/AdminForbidden";
import { requireAdminUser } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdminUser();

  if (!user.is_admin) {
    return <AdminForbidden />;
  }

  const { id } = await params;
  const userId = Number(id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return <AdminForbidden />;
  }

  return (
    <div className="py-4 lg:py-2">
      <AdminUserDetailClient userId={userId} />
    </div>
  );
}
