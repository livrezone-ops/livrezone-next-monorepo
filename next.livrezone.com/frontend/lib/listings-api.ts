// Récupération publique des annonces pour le SSR (SEO).
// Même convention d'URL que la page d'accueil (INTERNAL_API_URL puis NEXT_PUBLIC_API_URL).

export interface ListingSummary {
  id: number;
  user_id: number;
  title: string;
  price: number;
  discount_price?: number | null;
  book_condition: string;
  isbn_13?: string | null;
  cover_path?: string | null;
  cover_source_url?: string | null;
  book?: {
    isbn_13?: string | null;
    authors?: string[] | string | null;
    cover_url?: string | null;
  } | null;
  user?: {
    id: number;
    profile?: {
      nickname?: string | null;
      city?: {
        name?: string | null;
      } | null;
    } | null;
  } | null;
}

export interface PublicListingsResult {
  ok: boolean;
  data: ListingSummary[];
  total: number;
  lastPage: number;
  currentPage: number;
  priceMin?: number;
  priceMax?: number;
}

export interface ListingsQuery {
  search?: string;
  category?: string;
  level?: string;
  subject?: string;
  language?: string;
  condition?: string;
  cities?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface CityRef {
  id: number;
  name: string;
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

export function buildListingPath(listing: ListingSummary): string {
  const nickname =
    listing.user?.profile?.nickname || `utilisateur-${listing.user_id}`;
  const isbn = listing.isbn_13 || listing.book?.isbn_13 || "livre";
  const titleSlug = slugify(listing.title);
  return `/${nickname}/${listing.id}-${isbn}-${titleSlug}`;
}

const API_BASE = (process.env.INTERNAL_API_URL
  || process.env.NEXT_PUBLIC_API_URL
  || "https://api-next.livrezone.com").replace(/\/api\/?$/, "");

export async function getPublicListings(query: ListingsQuery): Promise<PublicListingsResult> {
  const params = new URLSearchParams();

  if (query.search) params.set("search", query.search);
  if (query.category) params.set("category", query.category);
  if (query.level) params.set("level", query.level);
  if (query.subject) params.set("subject", query.subject);
  if (query.language) params.set("language", query.language);
  if (query.condition) params.set("condition", query.condition);
  if (query.cities) params.set("city", query.cities);
  if (query.minPrice !== undefined && query.minPrice !== null) params.set("min_price", String(query.minPrice));
  if (query.maxPrice !== undefined && query.maxPrice !== null) params.set("max_price", String(query.maxPrice));
  params.set("sort", query.sort || "latest");
  params.set("page", String(query.page || 1));
  params.set("limit", String(query.limit || 12));

  const empty: PublicListingsResult = {
    ok: false,
    data: [],
    total: 0,
    lastPage: 1,
    currentPage: 1,
  };

  try {
    const res = await fetch(`${API_BASE}/api/listings?${params.toString()}`, {
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
      priceMin: json.price_min !== undefined && json.price_min !== null ? Number(json.price_min) : undefined,
      priceMax: json.price_max !== undefined && json.price_max !== null ? Number(json.price_max) : undefined,
    };
  } catch {
    return empty;
  }
}

export async function getReferenceData(): Promise<{ cities: CityRef[] }> {
  try {
    const res = await fetch(`${API_BASE}/api/reference-data`, {
      next: { revalidate: 3600 },
      headers: { Accept: "application/json", Host: "api-next.livrezone.com" },
    });
    if (!res.ok) throw new Error("reference-data error");
    const json = await res.json();
    return {
      cities: Array.isArray(json.cities) ? json.cities : [],
    };
  } catch {
    return { cities: [] };
  }
}