import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import AdminClient from "@/components/AdminClient";

export const dynamic = "force-dynamic";

interface AuthUser {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
}

async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");

    const baseUrl = (process.env.INTERNAL_API_URL
      || process.env.NEXT_PUBLIC_API_URL
      || "https://api-next.livrezone.com").replace(/\/api\/?$/, "");

    const res = await fetch(`${baseUrl}/api/user`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Host: "api-next.livrezone.com",
        Cookie: cookieHeader,
        Referer: "https://next.livrezone.com",
      },
    });

    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error("[SSR] admin getAuthUser error:", e);
    return null;
  }
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await getAuthUser();

  if (user === null) {
    redirect("/login");
  }

  if (!user.is_admin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-white px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center">
            <span className="text-rose-500 text-2xl font-black">403</span>
          </div>
          <h1 className="text-2xl font-black text-gray-950 mb-1">Accès non autorisé</h1>
          <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
            Cette section est réservée aux administrateurs. Si vous pensez qu&rsquo;il
            s&rsquo;agit d&rsquo;une erreur, contactez l&rsquo;équipe LivreZone.
          </p>
          <Link
            href="/"
            className="inline-flex mt-6 px-5 py-2.5 bg-[#6D28D9] text-white font-bold text-xs rounded-xl hover:bg-violet-800 transition-all"
          >
            Retour à l&rsquo;accueil
          </Link>
        </div>
      </div>
    );
  }

  const sp = await searchParams;
  const tabParam = typeof sp.tab === "string" ? sp.tab : undefined;
  const validTabs = ["listings", "users", "hero"] as const;
  const initialTab = tabParam && (validTabs as readonly string[]).includes(tabParam)
    ? (tabParam as (typeof validTabs)[number])
    : "listings";
  const filterParam = typeof sp.filter === "string" ? sp.filter : undefined;
  const validFilters = ["all", "online", "offline", "pending", "archived", "deleted"];
  const initialListingsFilter =
    filterParam && validFilters.includes(filterParam) ? filterParam : "pending";

  return (
    <div className="w-[90%] max-w-7xl mx-auto py-8">
      <AdminClient
        user={user}
        initialTab={initialTab}
        initialListingsFilter={initialListingsFilter}
      />
    </div>
  );
}