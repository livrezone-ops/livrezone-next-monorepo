import type { Metadata } from "next";
import { getBooks, BookSearchItem } from "@/lib/books-api";
import { toJsonLd } from "@/lib/safe-json-ld";
import { getReferenceData } from "@/lib/listings-api";
import { parseFilters } from "@/lib/listings-filters";
import { CATEGORIES } from "@/lib/reference-data";
import BooksClient from "./BooksClient";
import BooksHome from "./BooksHome";

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

function canonicalHref(search: string, page: number, categories: string[] = [], author = ""): string {
  const pairs: string[] = [];
  if (search) pairs.push(`search=${encodeURIComponent(search)}`);
  if (author) pairs.push(`author=${encodeURIComponent(author)}`);
  if (categories.length > 0) pairs.push(`categories=${encodeURIComponent(categories.join(","))}`);
  if (page > 1) pairs.push(`page=${page}`);
  return pairs.length > 0 ? `${SITE_URL}${PATH}?${pairs.join("&")}` : `${SITE_URL}${PATH}`;
}

// Nom lisible d'une catégorie (famille ou sous-catégorie) depuis l'arbre de référence.
function resolveCategoryLabel(code: string): string | null {
  for (const family of CATEGORIES) {
    if (family.code === code) return family.name;
    const child = family.children?.find((c) => c.code === code);
    if (child) return child.name;
  }
  return null;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sp = await searchParams;
  const search = firstParam(sp.search);
  // Filtre auteur (04/09/2026) : /books?author={nom} — chip côté front, box
  // de recherche vide. noindex : vue filtre non canonique (pas de page auteur).
  const author = firstParam(sp.author);
  const page = parseInt(firstParam(sp.page) || "1", 10) || 1;
  const categoryFilter = firstParam(sp.categories);
  const categoryCodes = categoryFilter ? categoryFilter.split(",").filter(Boolean) : [];
  const categoryLabel = categoryCodes.length === 1 ? resolveCategoryLabel(categoryCodes[0]) : null;

  let title: string;
  let description: string;

  if (author) {
    title = `Livres de ${author} — Catalogue LivreZone`;
    description = `Livres écrits par ${author} dans le catalogue LivreZone : titres, ISBN et annonces disponibles à la vente.`;
  } else if (search) {
    title = `Livres « ${search} » au Maroc`;
    description = `Recherchez « ${search} » dans le catalogue de livres de LivreZone : ISBN, titre, auteur.`;
  } else if (categoryLabel) {
    title = `Livres ${categoryLabel} — Catalogue & Référentiel`;
    description = `Parcourez les livres ${categoryLabel} du référentiel LivreZone, trouvez les annonces disponibles et déposez une demande de livre.`;
  } else {
    title = "Catalogue & Référentiel des livres au Maroc";
    description = "Parcourez le référentiel des livres, recherchez par titre et par auteur, et créez des demandes de livres.";
  }

  return {
    title,
    description,
    alternates: { canonical: canonicalHref(search, page, categoryCodes, author) },
    openGraph: { title, description, type: "website", locale: "fr_MA", siteName: "LivreZone" },
    robots:
      author || page > 1
        ? { index: false, follow: true }
        : { index: true, follow: true },
  };
}

export default async function LivresPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const f = parseFilters((key) => {
    const val = sp[key];
    return Array.isArray(val) ? val[0] : val || null;
  });

  const isDefaultView =
    !f.search &&
    !(f.author || "") &&
    f.categories.length === 0 &&
    f.languages.length === 0 &&
    f.levels.length === 0 &&
    f.page === 1;

  // Vue par défaut : page légère SANS aucun appel API (l'ancienne vitrine
  // attendait l'index auteurs = scan des ~700k livres, cache froid → page
  // inaccessible). La recherche Meilisearch prend le relais via le formulaire.
  if (isDefaultView) {
    return <BooksHome />;
  }

  // 1. Fetching logic — mode Recherche / Filtre uniquement.
  const [refData] = await Promise.all([
    getReferenceData(),
  ]);

  const result = await getBooks({
    search: f.search || undefined,
    author: f.author || undefined,
    categories: f.categories.length ? f.categories : undefined,
    languages: f.languages.length ? f.languages : undefined,
    levels: f.levels.length ? f.levels : undefined,
    page: f.page,
    limit: 12,
  });
  const facets = result.facets;

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
        sections={[]}
        isDefaultView={false}
        initialFacets={facets}
        recentBooks={[]}
        catalogTotal={result.total}
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