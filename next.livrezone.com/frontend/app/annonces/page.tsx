import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import FilterSidebar from "@/components/FilterSidebar";
import ListingsSearch from "@/components/ListingsSearch";
import {
  getPublicListings,
  getReferenceData,
  type CityRef,
  buildListingPath,
} from "@/lib/listings-api";
import {
  categoryLabel,
  levelLabel,
  languageLabel,
} from "@/lib/reference-data";
import { parseFilters, type AnnoncesFilters } from "@/lib/listings-filters";

export const revalidate = 60;

const SITE_URL = "https://next.livrezone.com";
const PATH = "/annonces";
const PRICE_MIN_LIMIT = 0;
const PRICE_MAX_LIMIT = 500;

type SearchParams = Record<string, string | string[] | undefined>;

interface PageProps {
  searchParams: Promise<SearchParams>;
}

function paramGetter(searchParams: SearchParams) {
  return (key: string): string | null => {
    const value = searchParams[key];
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  };
}

function cityLabels(
  f: AnnoncesFilters,
  cities: CityRef[]
): string[] {
  return f.cities
    .map((id) => cities.find((c) => c.id === id)?.name)
    .filter((n): n is string => Boolean(n));
}

function canonicalHref(f: AnnoncesFilters): string {
  const order: Array<[string, string | undefined]> = [
    ["search", f.search || undefined],
    ["category", f.categories.length ? f.categories.join(",") : undefined],
    ["level", f.levels.length ? f.levels.join(",") : undefined],
    ["language", f.languages.length ? f.languages.join(",") : undefined],
    ["condition", f.conditions.length ? f.conditions.join(",") : undefined],
    ["city", f.cities.length ? f.cities.join(",") : undefined],
    ["min_price", f.minPrice !== null && f.minPrice !== undefined ? String(f.minPrice) : undefined],
    ["max_price", f.maxPrice !== null && f.maxPrice !== undefined ? String(f.maxPrice) : undefined],
    ["sort", f.sort && f.sort !== "latest" ? f.sort : undefined],
    ["page", f.page > 1 ? String(f.page) : undefined],
  ];
  const pairs = order
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v!)}`);
  return pairs.length > 0
    ? `${SITE_URL}${PATH}?${pairs.join("&")}`
    : `${SITE_URL}${PATH}`;
}

function activeCategoryLabel(f: AnnoncesFilters): string | undefined {
  const labels = f.categories
    .map(categoryLabel)
    .filter((l): l is string => Boolean(l));
  return labels.length > 0 ? labels.join(", ") : undefined;
}

function buildTitle(f: AnnoncesFilters, cities: CityRef[]): string {
  const parts: string[] = [];

  const cats = f.categories.map(categoryLabel).filter(Boolean);
  const levels = f.levels.map(levelLabel).filter(Boolean);
  const langs = f.languages.map(languageLabel).filter(Boolean);
  const villes = cityLabels(f, cities);

  if (cats.length) parts.push(cats.join(", ").toLowerCase());
  if (levels.length) parts.push(`niveau ${levels.join(", ").toLowerCase()}`);
  if (langs.length) parts.push(`en ${langs.join(", ").toLowerCase()}`);
  if (villes.length) parts.push(`à ${villes.join(", ").toLowerCase()}`);

  if (f.conditions.length === 1) {
    parts.push(f.conditions[0] === "neuf" ? "neufs" : "d'occasion");
  } else if (f.conditions.length === 2) {
    parts.push("neufs et d'occasion");
  }

  if (f.minPrice !== null && f.maxPrice !== null) {
    parts.push(`de ${f.minPrice} à ${f.maxPrice} MAD`);
  } else if (f.minPrice !== null) {
    parts.push(`dès ${f.minPrice} MAD`);
  } else if (f.maxPrice !== null) {
    parts.push(`moins de ${f.maxPrice} MAD`);
  }

  if (f.search) parts.push(`« ${f.search} »`);

  const head =
    parts.length === 0
      ? "Annonces de livres neufs et d'occasion"
      : `Annonces de ${parts.join(" ")}`;
  const capitalized = head.charAt(0).toUpperCase() + head.slice(1);
  const pageSuffix = f.page > 1 ? ` - Page ${f.page}` : "";
  return `${capitalized} au Maroc${pageSuffix} | LivreZone`;
}

function buildDescription(f: AnnoncesFilters, cities: CityRef[]): string {
  const what =
    f.conditions.length === 1
      ? f.conditions[0] === "neuf"
        ? "livres neufs"
        : "livres d'occasion"
      : "livres neufs et d'occasion";

  let scope = "";
  const cats = f.categories.map(categoryLabel).filter(Boolean);
  if (cats.length) scope += ` dans la catégorie ${cats.join(", ").toLowerCase()}`;
  const levels = f.levels.map(levelLabel).filter(Boolean);
  if (levels.length) scope += ` (${levels.join(", ").toLowerCase()})`;
  const villes = cityLabels(f, cities);
  if (villes.length) scope += ` à ${villes.join(", ").toLowerCase()}`;

  if (f.minPrice !== null || f.maxPrice !== null) {
    const bounds =
      f.minPrice !== null && f.maxPrice !== null
        ? ` entre ${f.minPrice} et ${f.maxPrice} MAD`
        : f.minPrice !== null
          ? ` à partir de ${f.minPrice} MAD`
          : ` jusqu'à ${f.maxPrice} MAD`;
    scope += ` à prix${bounds}`;
  }

  const searchPart = f.search ? ` Résultats pour « ${f.search} ».` : "";
  return `Trouvez des ${what}${scope} proposés par des librairies et des particuliers au Maroc.${searchPart} Comparez les prix et négociez directement avec les vendeurs.`;
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const sp = await searchParams;
  const f = parseFilters(paramGetter(sp));
  const { cities } = await getReferenceData();
  const title = buildTitle(f, cities);
  const description = buildDescription(f, cities);
  const canonical = canonicalHref(f);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "fr_MA",
      siteName: "LivreZone",
      url: canonical,
    },
    robots:
      f.page > 1
        ? { index: false, follow: true }
        : { index: true, follow: true },
  };
}

function buildBreadcrumbJsonLd(f: AnnoncesFilters) {
  const items = [
    { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE_URL}/` },
    { "@type": "ListItem", position: 2, name: "Annonces", item: `${SITE_URL}${PATH}` },
  ];
  const active = activeCategoryLabel(f);
  if (f.categories.length && active) {
    items.push({
      "@type": "ListItem",
      position: 3,
      name: active,
      item: canonicalHref({ ...f, page: 1 }),
    });
  }
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}

export default async function AnnoncesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const f = parseFilters(paramGetter(sp));

  const [{ cities }, result] = await Promise.all([
    getReferenceData(),
    getPublicListings({
      search: f.search || undefined,
      category: f.categories.length ? f.categories.join(",") : undefined,
      level: f.levels.length ? f.levels.join(",") : undefined,
      language: f.languages.length ? f.languages.join(",") : undefined,
      condition: f.conditions.length ? f.conditions.join(",") : undefined,
      cities: f.cities.length ? f.cities.join(",") : undefined,
      minPrice: f.minPrice ?? undefined,
      maxPrice: f.maxPrice ?? undefined,
      sort: f.sort || undefined,
      page: f.page,
      limit: 12,
    }),
  ]);

  const activeCategory = activeCategoryLabel(f);
  const priceMinLimit =
    result.ok && result.priceMin !== undefined
      ? Math.floor(result.priceMin)
      : PRICE_MIN_LIMIT;
  const priceMaxLimit =
    result.ok && result.priceMax !== undefined
      ? Math.ceil(result.priceMax)
      : PRICE_MAX_LIMIT;
  const articleCount = result.ok
    ? `${result.total} ${result.total > 1 ? "articles" : "article"}`
    : null;

  const hasActiveFilters = Boolean(
    f.categories.length > 0 ||
    f.levels.length > 0 ||
    f.languages.length > 0 ||
    f.conditions.length > 0 ||
    f.cities.length > 0 ||
    (f.minPrice !== null && f.minPrice > priceMinLimit) ||
    (f.maxPrice !== null && f.maxPrice < priceMaxLimit) ||
    Boolean(f.search)
  );

  const jsonLdItemList =
    result.ok && result.data.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: result.data.map((listing, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: `${SITE_URL}${buildListingPath(listing)}`,
            name: listing.title,
          })),
        }
      : null;

  return (
    <div className="w-[90%] max-w-7xl mx-auto py-8">
      {/* Breadcrumb */}
      <nav
        aria-label="Fil d'Ariane"
        className="mb-4 text-[13px] md:text-[14px] italic text-gray-500 flex items-center gap-2 flex-wrap"
      >
        <Link href="/" className="hover:text-black transition-colors not-italic">
          Accueil
        </Link>
        <span className="not-italic text-gray-400">/</span>
        <Link
          href="/annonces"
          className={`hover:text-black transition-colors ${
            activeCategory ? "" : "text-black font-semibold"
          }`}
        >
          Annonces
        </Link>
        {activeCategory && (
          <>
            <span className="not-italic text-gray-400">/</span>
            <span className="text-black font-semibold">{activeCategory}</span>
          </>
        )}
      </nav>

      {/* En-tête de page */}
      <div className="flex flex-col md:flex-row md:items-end justify-between pb-4 mb-6 border-b border-gray-100">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-black mb-1">
            Annonces
          </h1>
          <div className="flex items-center gap-2.5 flex-wrap mt-1">
            {articleCount && (
              <span className="text-[13px] text-gray-500 font-medium">
                {articleCount}
              </span>
            )}
            {hasActiveFilters && (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 border border-slate-200/80 px-2.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6D28D9]" />
                <span className="text-slate-500 italic">(filtré)</span>
                <span className="text-slate-300">·</span>
                <Link
                  href="/annonces"
                  className="text-[#6D28D9] hover:text-violet-900 font-bold hover:underline inline-flex items-center gap-1 transition-colors"
                  title="Effacer tous les filtres"
                >
                  <span>Effacer les filtres</span>
                  <X className="w-3 h-3" />
                </Link>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-start">
        {/* Sidebar filtres */}
        <Suspense
          fallback={
            <aside className="lg:w-[240px] lg:flex-shrink-0 hidden lg:block">
              <div className="animate-pulse h-96 bg-gray-100 rounded-xl" />
            </aside>
          }
        >
          <FilterSidebar
            priceMinLimit={priceMinLimit}
            priceMaxLimit={priceMaxLimit}
            cities={cities}
          />
        </Suspense>

        {/* Contenu principal */}
        <main className="flex-1 min-w-0 w-full">
          <Suspense
            fallback={
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6D28D9]"></div>
              </div>
            }
          >
            <ListingsSearch
              initialListings={result.ok ? result.data : undefined}
              initialTotal={result.ok ? result.total : undefined}
              initialLastPage={result.ok ? result.lastPage : undefined}
            />
          </Suspense>
        </main>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbJsonLd(f)) }}
      />
      {jsonLdItemList && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdItemList) }}
        />
      )}
    </div>
  );
}