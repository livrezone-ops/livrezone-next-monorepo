import type { Metadata } from "next";
import { getLibraries, type LibraryItem } from "@/lib/libraries-api";
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

function canonicalHref(search: string, condition: string, city: number | null, sort: string, page: number): string {
  const pairs: string[] = [];
  if (search) pairs.push(`search=${encodeURIComponent(search)}`);
  if (condition) pairs.push(`condition=${encodeURIComponent(condition)}`);
  if (city) pairs.push(`city=${city}`);
  if (sort && sort !== "rating") pairs.push(`sort=${sort}`);
  if (page > 1) pairs.push(`page=${page}`);
  return pairs.length > 0 ? `${SITE_URL}${PATH}?${pairs.join("&")}` : `${SITE_URL}${PATH}`;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sp = await searchParams;
  const city = parseInt(firstParam(sp.city) || "", 10) || null;
  const page = parseInt(firstParam(sp.page) || "1", 10) || 1;
  const search = firstParam(sp.search);
  const condition = firstParam(sp.condition);

  const title = search
    ? `Librairies « ${search} » | LivreZone`
    : "Annuaire des librairies en ligne au Maroc | LivreZone";
  const description = search
    ? `Découvrez les librairies correspondant à « ${search} » sur LivreZone : ville, note et nombre de publications.`
    : "Parcourez l'annuaire des librairies et vendeurs de livres au Maroc. Filtrez par ville et par condition des livres, triez par note ou par nombre de publications.";

  return {
    title,
    description,
    alternates: { canonical: canonicalHref(search, condition, city, firstParam(sp.sort), page) },
    openGraph: { title, description, type: "website", locale: "fr_MA", siteName: "LivreZone" },
    robots: page > 1 ? { index: false, follow: true } : { index: true, follow: true },
  };
}

function parseFilters(sp: SearchParams) {
  const cityRaw = parseInt(firstParam(sp.city) || "", 10);
  const condition = firstParam(sp.condition);
  const sortRaw = firstParam(sp.sort);
  return {
    city: Number.isFinite(cityRaw) && cityRaw > 0 ? cityRaw : null,
    condition: condition === "neuf" || condition === "occas" ? condition : null,
    search: firstParam(sp.search) || "",
    sort: sortRaw === "publications" ? "publications" : "rating",
    page: Math.max(1, parseInt(firstParam(sp.page) || "1", 10) || 1),
  };
}

export default async function LibrairiesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const f = parseFilters(sp);

  const [result, refData] = await Promise.all([
    getLibraries({
      city: f.city,
      condition: f.condition,
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
        initialCity={f.city}
        initialCondition={f.condition}
        initialSort={f.sort}
        cities={refData.cities || []}
      />

      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
    </>
  );
}
