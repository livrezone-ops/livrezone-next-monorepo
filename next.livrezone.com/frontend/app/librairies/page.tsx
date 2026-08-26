import type { Metadata } from "next";
import { getLibraries, type LibraryItem } from "@/lib/libraries-api";
import { toJsonLd } from "@/lib/safe-json-ld";
import { getReferenceData, type CityRef } from "@/lib/listings-api";
import LibrariesClient from "./LibrariesClient";

export const revalidate = 60;

const SITE_URL = "https://next.livrezone.com";
const PATH = "/librairies";

type SearchParams = Record<string, string | string[] | undefined>;

interface PageProps {
  searchParams: Promise<SearchParams>;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function toList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const parts = Array.isArray(value) ? value : value.split(",");
  return parts.map((p) => p.trim()).filter(Boolean);
}

function canonicalHref(search: string, conditions: string[], cities: number[], sort: string, page: number): string {
  const pairs: string[] = [];
  if (search) pairs.push(`search=${encodeURIComponent(search)}`);
  if (conditions.length) pairs.push(`condition=${encodeURIComponent(conditions.join(","))}`);
  if (cities.length) pairs.push(`city=${cities.join(",")}`);
  if (sort && sort !== "publications") pairs.push(`sort=${sort}`);
  if (page > 1) pairs.push(`page=${page}`);
  return pairs.length > 0 ? `${SITE_URL}${PATH}?${pairs.join("&")}` : `${SITE_URL}${PATH}`;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sp = await searchParams;
  const cities = toList(sp.city).map(Number).filter(n => Number.isFinite(n) && n > 0);
  const page = parseInt(firstParam(sp.page) || "1", 10) || 1;
  const search = firstParam(sp.search);
  const conditions = toList(sp.condition).filter(c => c === "neuf" || c === "occas");

  const title = search
    ? `Librairies à « ${search} » | LivreZone`
    : "Annuaire des librairies en ligne au Maroc | LivreZone";

  const description = search
    ? `Découvrez les librairies correspondant à « ${search} » sur LivreZone : ville, note et nombre de publications.`
    : "Parcourez l'annuaire des librairies et vendeurs de livres au Maroc. Filtrez par ville et par condition des livres, triez par note ou par nombre de publications.";

  return {
    title,
    description,
    alternates: { canonical: canonicalHref(search, conditions, cities, firstParam(sp.sort), page) },
    openGraph: { title, description, type: "website", locale: "fr_MA", siteName: "LivreZone" },
    robots: page > 1 ? { index: false, follow: true } : { index: true, follow: true },
  };
}

function parseFilters(sp: SearchParams) {
  const sortRaw = firstParam(sp.sort);
  return {
    cities: toList(sp.city).map(Number).filter(n => Number.isFinite(n) && n > 0),
    conditions: toList(sp.condition).filter(c => c === "neuf" || c === "occas"),
    search: firstParam(sp.search) || "",
    sort: sortRaw === "rating" ? "rating" : "publications",
    page: Math.max(1, parseInt(firstParam(sp.page) || "1", 10) || 1),
  };
}

export default async function LibrairiesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const f = parseFilters(sp);

  const [result, refData] = await Promise.all([
    getLibraries({
      cities: f.cities,
      conditions: f.conditions,
      search: f.search || null,
      sort: f.sort,
      page: f.page,
    }),
    getReferenceData(),
  ]);

  const jsonLd =
    result.ok && result.data.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: result.data.map((lib: LibraryItem, index: number) => ({
            "@type": "ListItem",
            position: index + 1,
            name: lib.name,
            url: `${SITE_URL}/${lib.nickname}`,
          })),
        }
      : null;

  return (
    <>
      <LibrariesClient
        initialLibraries={result.data}
        initialTotal={result.total}
        initialPage={result.currentPage}
        initialLastPage={result.lastPage}
        initialSearch={f.search}
        initialCities={f.cities}
        initialConditions={f.conditions}
        initialSort={f.sort}
        initialFacets={result.facets}
        cities={refData.cities || []}
      />

      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: toJsonLd(jsonLd) }}
        />
      )}
    </>
  );
}
