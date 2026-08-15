// Lecture / écriture des filtres de la page /annonces dans l'URL.
// Partagé entre la page SSR et les composants client.

export interface AnnoncesFilters {
  categories: string[];
  levels: string[];
  languages: string[];
  conditions: string[];
  cities: number[];
  minPrice: number | null;
  maxPrice: number | null;
  search: string;
  sort: string;
  page: number;
}

export type ParamGetter = (key: string) => string | null;

function toList(value: string | string[] | null | undefined): string[] {
  if (value === null || value === undefined) return [];
  const parts = Array.isArray(value) ? value : value.split(",");
  return parts
    .map((p) => p.trim())
    .filter(Boolean);
}

function toNumber(value: string | null): number | null {
  if (value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toNumbers(value: string | string[] | null | undefined): number[] {
  return toList(value)
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n));
}

// Fusionne les valeurs issues de plusieurs paramètres (ex: category + categories).
function unionLists(lists: (string | string[] | null | undefined)[]): string[] {
  const out = new Set<string>();
  lists.forEach((list) => {
    toList(list).forEach((item) => out.add(item));
  });
  return Array.from(out);
}

export function parseFilters(get: ParamGetter): AnnoncesFilters {
  return {
    categories: unionLists([get("categories"), get("category"), get("c")]),
    levels: unionLists([get("levels"), get("level"), get("lvl")]),
    languages: unionLists([get("languages"), get("language"), get("l")]),
    conditions: unionLists([get("conditions"), get("condition"), get("cond")]),
    cities: Array.from(
      new Set([
        ...toNumbers(get("city")),
        ...toNumbers(get("cities")),
        ...toNumbers(get("city_id")),
      ])
    ),
    minPrice: toNumber(get("min_price") ?? get("min")),
    maxPrice: toNumber(get("max_price") ?? get("max")),
    search: get("search") || "",
    sort: get("sort") || "latest",
    page: toNumber(get("page")) || 1,
  };
}

export interface SerializedFilters {
  search?: string;
  category?: string;
  level?: string;
  language?: string;
  condition?: string;
  min_price?: string;
  max_price?: string;
  sort?: string;
  page?: string;
}

// Construit la QueryString à partir des filtres (paramètres canoniques).
export function buildFilterQuery(
  filters: {
    categories?: string[];
    levels?: string[];
    languages?: string[];
    conditions?: string[];
    cities?: number[];
    minPrice?: number | null;
    maxPrice?: number | null;
    minLimit?: number;
    maxLimit?: number;
    search?: string;
    sort?: string;
    page?: number;
  }
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.search) params.set("search", filters.search);
  if (filters.categories?.length) params.set("category", filters.categories.join(","));
  if (filters.levels?.length) params.set("level", filters.levels.join(","));
  if (filters.languages?.length) params.set("language", filters.languages.join(","));
  if (filters.conditions?.length) params.set("condition", filters.conditions.join(","));
  if (filters.cities?.length) params.set("city", filters.cities.join(","));

  const minLimit = filters.minLimit ?? 0;
  const maxLimit = filters.maxLimit ?? 500;
  if (filters.minPrice !== null && filters.minPrice !== undefined && filters.minPrice > minLimit) {
    params.set("min_price", String(filters.minPrice));
  }
  if (filters.maxPrice !== null && filters.maxPrice !== undefined && filters.maxPrice < maxLimit) {
    params.set("max_price", String(filters.maxPrice));
  }

  if (filters.sort && filters.sort !== "latest") params.set("sort", filters.sort);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));

  return params;
}