// Récupération publique du catalogue de livres (table books) pour le SSR.

export interface BookSearchItem {
  id: number;
  isbn_13: string | null;
  title: string | null;
  authors?: string[] | string | null;
  publisher?: string | null;
  cover_url?: string | null;
}

export interface BooksResult {
  ok: boolean;
  data: BookSearchItem[];
  total: number;
  lastPage: number;
  currentPage: number;
}

const API_BASE = (process.env.INTERNAL_API_URL
  || process.env.NEXT_PUBLIC_API_URL
  || "https://api-next.livrezone.com").replace(/\/api\/?$/, "");

export async function getBooks(query: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<BooksResult> {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  params.set("page", String(query.page || 1));
  params.set("limit", String(query.limit || 24));

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
    };
  } catch {
    return empty;
  }
}