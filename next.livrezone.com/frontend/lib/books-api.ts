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
  category_id?: string | number;
  categories?: string[] | string;
  languages?: string[] | string;
  levels?: string[] | string;
  page?: number;
  limit?: number;
  facets?: boolean;
  sort?: string;
}): Promise<BooksResult> {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.field) params.set("field", query.field);
  if (query.facets === false) params.set("facets", "0");
  if (query.sort) params.set("sort", query.sort);
  
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
// Auteurs du catalogue (agrégat côté API, GET /api/books/authors)
// ---------------------------------------------------------------------------

export interface AuthorSummary {
  name: string;
  slug: string;
  books_count: number;
  cover_url?: string | null;
}

export interface AuthorsResult {
  ok: boolean;
  data: AuthorSummary[];
  total: number;
  totalAuthors: number;
  lastPage: number;
  currentPage: number;
  letters?: Record<string, number>;
}

export async function getBookAuthors(query: {
  letter?: string;
  sort?: "top" | "alpha";
  page?: number;
  limit?: number;
}): Promise<AuthorsResult> {
  const params = new URLSearchParams();
  if (query.letter && query.letter !== "all") params.set("letter", query.letter);
  if (query.sort) params.set("sort", query.sort);
  params.set("page", String(query.page || 1));
  params.set("limit", String(query.limit || 24));

  const empty: AuthorsResult = {
    ok: false,
    data: [],
    total: 0,
    totalAuthors: 0,
    lastPage: 1,
    currentPage: 1,
  };

  try {
    const res = await fetch(`${API_BASE}/api/books/authors?${params.toString()}`, {
      next: { revalidate: 300 },
      headers: { Accept: "application/json", Host: "api-next.livrezone.com" },
    });
    if (!res.ok) return empty;

    const json = await res.json();
    return {
      ok: true,
      data: Array.isArray(json.data) ? json.data : [],
      total: Number(json.total || 0),
      totalAuthors: Number(json.total_authors || 0),
      lastPage: Number(json.last_page || 1),
      currentPage: Number(json.current_page || 1),
      letters: json.letters || {},
    };
  } catch {
    return empty;
  }
}

export interface AuthorDetailResult {
  ok: boolean;
  author: AuthorSummary;
  books: BookSearchItem[];
  total: number;
  lastPage: number;
  currentPage: number;
}

export async function getAuthorBySlug(
  slug: string,
  page = 1,
  limit = 12
): Promise<AuthorDetailResult | null> {
  try {
    const params = new URLSearchParams();
    params.set("page", String(page || 1));
    params.set("limit", String(limit));

    const res = await fetch(`${API_BASE}/api/books/authors/${encodeURIComponent(slug)}?${params.toString()}`, {
      next: { revalidate: 60 },
      headers: { Accept: "application/json", Host: "api-next.livrezone.com" },
    });
    if (!res.ok) return null;

    const json = await res.json();
    if (!json?.author) return null;

    return {
      ok: true,
      author: json.author,
      books: Array.isArray(json.books) ? json.books : [],
      total: Number(json.total || 0),
      lastPage: Number(json.last_page || 1),
      currentPage: Number(json.current_page || 1),
    };
  } catch {
    return null;
  }
}