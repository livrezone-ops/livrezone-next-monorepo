import AdminListingEdit from "@/components/admin/AdminListingEdit";
import AdminForbidden from "@/components/admin/AdminForbidden";
import { requireAdminUser } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminEditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdminUser();

  if (!user.is_admin) {
    return <AdminForbidden />;
  }

  const { id } = await params;
  const listingId = Number(id);

  if (!Number.isInteger(listingId) || listingId <= 0) {
    return <AdminForbidden />;
  }

  return (
    <div className="py-4 lg:py-2">
      <AdminListingEdit user={user} listingId={listingId} />
    </div>
  );
}
