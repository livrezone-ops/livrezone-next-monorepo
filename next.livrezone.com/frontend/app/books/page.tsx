import type { Metadata } from "next";
import { getBooks, BookSearchItem, type BooksResult } from "@/lib/books-api";
import { toJsonLd } from "@/lib/safe-json-ld";
import { getReferenceData } from "@/lib/listings-api";
import { parseFilters } from "@/lib/listings-filters";
import BooksClient from "./BooksClient";

export const revalidate = 60;

const SITE_URL = "https://next.livrezone.com";
const PATH = "/books";

type SearchParams = Record<string, string | string[] | undefined>;

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export interface BookSection {
  code: string;
  name: string;
  books: BookSearchItem[];
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function canonicalHref(search: string, page: number): string {
  const pairs: string[] = [];
  if (search) pairs.push(`search=${encodeURIComponent(search)}`);
  if (page > 1) pairs.push(`page=${page}`);
  return pairs.length > 0 ? `${SITE_URL}${PATH}?${pairs.join("&")}` : `${SITE_URL}${PATH}`;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sp = await searchParams;
  const search = firstParam(sp.search);
  const page = parseInt(firstParam(sp.page) || "1", 10) || 1;

  const title = search
    ? `Livres « ${search} » au Maroc | LivreZone`
    : "Catalogue & Référentiel des livres au Maroc | LivreZone";
  const description = search
    ? `Recherchez « ${search} » dans le catalogue de livres de LivreZone : ISBN, titre, auteur.`
    : "Parcourez le référentiel des livres, recherchez par titre et par auteur, et créez des demandes de livres.";

  return {
    title,
    description,
    alternates: { canonical: canonicalHref(search, page) },
    openGraph: { title, description, type: "website", locale: "fr_MA", siteName: "LivreZone" },
    robots:
      page > 1 ? { index: false, follow: true } : { index: true, follow: true },
  };
}

const HOME_CATEGORIES = [
  { code: "LITTERATURE", name: "Littérature & Romans" },
  { code: "JEUNESSE", name: "Jeunesse & Contes" },
  { code: "SCOLAIRE", name: "Scolaire & Éducatif" },
  { code: "UNIVERSITAIRE", name: "Universitaire & Professionnel" },
  { code: "RELIGION", name: "Religion & Spiritualité" },
  { code: "VIE_PRATIQUE", name: "Vie pratique & Loisirs" },
];

export default async function LivresPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const f = parseFilters((key) => {
    const val = sp[key];
    return Array.isArray(val) ? val[0] : val || null;
  });

  const isDefaultView =
    !f.search &&
    f.categories.length === 0 &&
    f.languages.length === 0 &&
    f.levels.length === 0 &&
    f.page === 1;

  // 1. Fetching logic
  let sections: BookSection[] = [];
  let facets: BooksResult['facets'];
  let result: BooksResult = {
    ok: true,
    data: [] as BookSearchItem[],
    total: 0,
    currentPage: 1,
    lastPage: 1,
  };

  const [refData] = await Promise.all([
    getReferenceData(),
  ]);

  if (isDefaultView) {
    // Mode "Netflix" : on charge 6 lignes de catégories
    const sectionPromises = HOME_CATEGORIES.map(async (cat) => {
      const res = await getBooks({
        categories: cat.code,
        limit: 12, // Nombre de livres dans le slider horizontal
        facets: false, // Les facettes sont récupérées une seule fois ci-dessous
      });
      return {
        code: cat.code,
        name: cat.name,
        books: res.data || [],
      };
    });
    const [resolvedSections, facetsRes] = await Promise.all([
      Promise.all(sectionPromises),
      getBooks({ limit: 1 }), // Récupère les facettes du catalogue complet
    ]);
    sections = resolvedSections.filter((s) => s.books.length > 0);
    facets = facetsRes.facets;
  } else {
    // Mode Recherche / Filtre : pagination classique
    result = await getBooks({
      search: f.search || undefined,
      categories: f.categories.length ? f.categories : undefined,
      languages: f.languages.length ? f.languages : undefined,
      levels: f.levels.length ? f.levels : undefined,
      page: f.page,
      limit: 12,
    });
    facets = result.facets;
  }

  const jsonLdItemList =
    !isDefaultView && result.ok && result.data.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: result.data.map((book, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: book.title || "Livre",
          })),
        }
      : null;

  return (
    <>
      <BooksClient
        initialBooks={result.data}
        initialTotal={result.total}
        initialPage={result.currentPage}
        initialLastPage={result.lastPage}
        initialSearch={f.search || ""}
        cities={refData.cities || []}
        sections={sections}
        isDefaultView={isDefaultView}
        initialFacets={facets}
      />

      {jsonLdItemList && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: toJsonLd(jsonLdItemList) }}
        />
      )}
    </>
  );
}