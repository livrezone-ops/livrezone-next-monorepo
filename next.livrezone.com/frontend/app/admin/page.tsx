import AdminClient from "@/components/AdminClient";
import AdminForbidden from "@/components/admin/AdminForbidden";
import { requireAdminUser } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireAdminUser();

  if (!user.is_admin) {
    return <AdminForbidden />;
  }

  const sp = await searchParams;
  const filterParam = typeof sp.filter === "string" ? sp.filter : undefined;
  const validFilters = ["all", "online", "offline", "pending", "archived", "deleted"];
  const initialListingsFilter =
    filterParam && validFilters.includes(filterParam) ? filterParam : "pending";

  return (
    <div className="py-4 lg:py-2">
      <AdminClient
        user={user}
        initialTab="listings"
        initialListingsFilter={initialListingsFilter}
        singleTab
      />
    </div>
  );
}
