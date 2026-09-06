// Récupération publique du catalogue de livres (table books) pour le SSR.

export interface BookSearchItem {
  id: number;
  isbn_13: string | null;
  title: string | null;
  authors?: string[] | string | null;
  publisher?: string | null;
  cover_url?: string | null;
  cover_thumbnail_url?: string | null;
  cover_thumbnail_url_320?: string | null;
  active_listings_count?: number | null;
  indicative_price?: number | null;
  indicative_price_currency?: string | null;
  category?: {
    id: number;
    name_fr: string;
  } | null;
  language?: {
    id: number;
    name_fr: string;
  } | null;
  level?: {
    id: number;
    name_fr: string;
  } | null;
}

export interface BooksResult {
  ok: boolean;
  data: BookSearchItem[];
  total: number;
  lastPage: number;
  currentPage: number;
  facets?: {
    categories?: Record<string, number>;
    languages?: Record<string, number>;
    levels?: Record<string, number>;
  };
}

const API_BASE = (process.env.INTERNAL_API_URL
  || process.env.NEXT_PUBLIC_API_URL
  || "https://api-next.livrezone.com").replace(/\/api\/?$/, "");

export async function getBooks(query: {
  search?: string;
  field?: string;
  author?: string;
  category_id?: string | number;
  categories?: string[] | string;
  languages?: string[] | string;
  levels?: string[] | string;
  subjects?: string[] | string;
  publisher?: string;
  page?: number;
  limit?: number;
  facets?: boolean;
  sort?: string;
}): Promise<BooksResult> {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.author) params.set("author", query.author);
  if (query.field) params.set("field", query.field);
  if (query.facets === false) params.set("facets", "0");
  if (query.sort) params.set("sort", query.sort);
  if (query.publisher) params.set("publisher", query.publisher);

  if (query.categories) {
    params.set("categories", Array.isArray(query.categories) ? query.categories.join(",") : query.categories);
  } else if (query.category_id) {
    params.set("categories", String(query.category_id));
  }

  if (query.languages) {
    params.set("languages", Array.isArray(query.languages) ? query.languages.join(",") : query.languages);
  }

  if (query.levels) {
    params.set("levels", Array.isArray(query.levels) ? query.levels.join(",") : query.levels);
  }

  if (query.subjects) {
    params.set("subjects", Array.isArray(query.subjects) ? query.subjects.join(",") : query.subjects);
  }

  params.set("page", String(query.page || 1));
  params.set("limit", String(query.limit || 12));

  const empty: BooksResult = {
    ok: false,
    data: [],
    total: 0,
    lastPage: 1,
    currentPage: 1,
  };

  try {
    const res = await fetch(`${API_BASE}/api/books?${params.toString()}`, {
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
      facets: json.facets,
    };
  } catch {
    return empty;
  }
}

// ---------------------------------------------------------------------------
// Sitemaps XML + annuaire éditeurs (SEO catalogue, 06/09). Fetches serveur avec
// cache long : les chunks livres (50k URLs) ne sont régénérés qu'une fois/jour.
// ---------------------------------------------------------------------------

export interface SitemapBooksMeta {
  total: number;
  chunk_size: number;
  chunks: { chunk: number; min_id: number; max_id: number }[] | null;
}

export interface SitemapBookRow {
  id: number;
  isbn: string | null;
  title: string | null;
  updated_at: string | null;
}

export interface SitemapListingsMeta {
  total: number;
  per_page: number;
  pages: number;
}

export interface SitemapListingRow {
  id: number;
  isbn: string | null;
  title: string | null;
  nickname: string;
  updated_at: string | null;
}

export interface PublisherRef {
  name: string;
  slug: string;
  books_count: number;
}

export interface PublishersPage {
  data: PublisherRef[];
  total: number;
  current_page: number;
  last_page: number;
}

async function fetchJson<T>(path: string, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      next: { revalidate },
      headers: { Accept: "application/json", Host: "api-next.livrezone.com" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getSitemapBooksMeta(): Promise<SitemapBooksMeta | null> {
  return fetchJson<SitemapBooksMeta>("/api/sitemap/books/meta", 86400);
}

export async function getSitemapBooks(
  minId: number,
  maxId: number,
): Promise<SitemapBookRow[] | null> {
  const json = await fetchJson<{ data: SitemapBookRow[] }>(
    `/api/sitemap/books?min_id=${minId}&max_id=${maxId}`,
    86400,
  );
  return json?.data ?? null;
}

export async function getSitemapListingsMeta(): Promise<SitemapListingsMeta | null> {
  return fetchJson<SitemapListingsMeta>("/api/sitemap/listings/meta", 3600);
}

export async function getSitemapListings(page: number): Promise<SitemapListingRow[] | null> {
  const json = await fetchJson<{ data: SitemapListingRow[] }>(
    `/api/sitemap/listings?page=${page}`,
    3600,
  );
  return json?.data ?? null;
}

export async function getPublishersPage(
  page: number,
  perPage = 100,
): Promise<PublishersPage | null> {
  return fetchJson<PublishersPage>(
    `/api/sitemap/publishers?page=${page}&per_page=${perPage}`,
    86400,
  );
}

export async function getPublisher(slug: string): Promise<PublisherRef | null> {
  const json = await fetchJson<{ publisher: PublisherRef }>(
    `/api/sitemap/publishers/${encodeURIComponent(slug)}`,
    86400,
  );
  return json?.publisher ?? null;
}

export async function getRelatedBooks(bookId: number): Promise<BookSearchItem[] | null> {
  const json = await fetchJson<{ data: BookSearchItem[] }>(
    `/api/books/${bookId}/related`,
    21600,
  );
  return json?.data ?? null;
}
