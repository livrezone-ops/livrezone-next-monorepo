// Récupération publique de l'annuaire des librairies (profils vendeurs) côté SSR.

export interface LibraryItem {
  id: number;
  user_id: number;
  nickname: string;
  name: string;
  profile_type?: string | null;
  subscription_type?: string | null;
  logo?: string | null;
  adresse?: string | null;
  rating_average: number;
  rating_count: number;
  listing_count: number;
  city?: { id: number; name: string } | null;
}

export interface LibrariesResult {
  ok: boolean;
  data: LibraryItem[];
  total: number;
  lastPage: number;
  currentPage: number;
}

export interface LibrariesQuery {
  city?: number | null;
  condition?: string | null;
  search?: string | null;
  sort?: string | null;
  page?: number;
}

const API_BASE = (process.env.INTERNAL_API_URL
  || process.env.NEXT_PUBLIC_API_URL
  || "https://api-next.livrezone.com").replace(/\/api\/?$/, "");

export async function getLibraries(query: LibrariesQuery): Promise<LibrariesResult> {
  const params = new URLSearchParams();
  if (query.city) params.set("city", String(query.city));
  if (query.condition) params.set("condition", query.condition);
  if (query.search) params.set("search", query.search);
  if (query.sort) params.set("sort", query.sort);
  params.set("page", String(query.page || 1));

  const empty: LibrariesResult = {
    ok: false,
    data: [],
    total: 0,
    lastPage: 1,
    currentPage: query.page || 1,
  };

  try {
    const res = await fetch(`${API_BASE}/api/libraries?${params.toString()}`, {
      next: { revalidate: 60 },
      headers: { Accept: "application/json", Host: "api-next.livrezone.com" },
    });
    if (!res.ok) return empty;

    const json = await res.json();
    return {
      ok: true,
      data: Array.isArray(json.data) ? json.data : [],
      total: Number(json.total || 0),
      lastPage: Number(json.last_page || 1),
      currentPage: Number(json.current_page || 1),
    };
  } catch {
    return empty;
  }
}
