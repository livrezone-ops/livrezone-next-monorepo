import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, ChevronLeft, ChevronRight, Tag } from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";
import BookCatalogCard from "@/components/BookCatalogCard";
import { getBooks } from "@/lib/books-api";
import { CATEGORIES } from "@/lib/reference-data";
import { toJsonLd } from "@/lib/safe-json-ld";

export const revalidate = 60;

const SITE_URL = "https://next.livrezone.com";

interface PageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface ResolvedTheme {
  name: string;
  familyCode: string;
  familyName: string;
  children: { code: string; name: string }[];
}

// Résout une famille ou une sous-catégorie depuis l'arbre de référence.
function resolveTheme(code: string): ResolvedTheme | null {
  for (const family of CATEGORIES) {
    if (family.code === code) {
      return {
        name: family.name,
        familyCode: family.code,
        familyName: family.name,
        children: family.children || [],
      };
    }
    const child = family.children?.find((c) => c.code === code);
    if (child) {
      return {
        name: child.name,
        familyCode: family.code,
        familyName: family.name,
        children: [],
      };
    }
  }
  return null;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const sp = await searchParams;
  const page = parseInt(firstParam(sp.page) || "1", 10) || 1;
  const theme = resolveTheme(code.toUpperCase());

  if (!theme) return { title: "Rayon introuvable" };

  const title = `Livres ${theme.name} — Catalogue & Référentiel`;
  const description = `Parcourez les livres ${theme.name} du référentiel LivreZone : titres, auteurs et annonces disponibles à la vente.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/books/themes/${code.toUpperCase()}` },
    openGraph: { title, description, type: "website", locale: "fr_MA", siteName: "LivreZone" },
    robots: page > 1 ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function ThemePage({ params, searchParams }: PageProps) {
  const { code: rawCode } = await params;
  const sp = await searchParams;
  const code = rawCode.toUpperCase();
  const theme = resolveTheme(code);
  if (!theme) notFound();

  const page = parseInt(firstParam(sp.page) || "1", 10) || 1;

  // 12 livres max par page (règle architecture 03/09 : pagination 12 par 12,
  // exclusivement Meilisearch côté API).
  const result = await getBooks({ categories: code, page, limit: 12 });

  // Comptes par sous-thème depuis les facettes (codes directs des livres).
  const childCounts = theme.children
    .map((child) => ({ ...child, count: result.facets?.categories?.[child.code] ?? 0 }))
    .filter((child) => child.count > 0);

  const jsonLd =
    result.ok && result.data.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `Livres ${theme.name}`,
          numberOfItems: result.total,
          itemListElement: result.data.map((book, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: book.title || "Livre",
          })),
        }
      : null;

  const breadcrumbItems =
    theme.familyName !== theme.name
      ? [
          { label: "Catalogue des livres", href: "/books" },
          { label: theme.familyName, href: `/books/themes/${theme.familyCode}` },
          { label: theme.name },
        ]
      : [
          { label: "Catalogue des livres", href: "/books" },
          { label: theme.name },
        ];

  return (
    <div className="w-[90%] max-w-7xl mx-auto py-8">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: toJsonLd(jsonLd) }}
        />
      )}

      <Breadcrumbs items={breadcrumbItems} />

      {/* En-tête du rayon */}
      <div className="bg-gradient-to-r from-[#1a0a40] via-[#2a1154] to-[#6D28D9] text-white rounded-2xl p-6 sm:p-8 shadow-md mb-8 relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-violet-200 text-xs font-bold mb-3 border border-white/15 backdrop-blur-xs">
            <Tag className="w-3.5 h-3.5 text-violet-300" />
            <span>Rayon</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2.5">
            Livres {theme.name}
          </h1>
          <p className="text-sm text-violet-100/90 font-normal">
            {result.total > 0
              ? `${result.total.toLocaleString("fr-FR")} titre${result.total > 1 ? "s" : ""} référencé${result.total > 1 ? "s" : ""} dans ce rayon`
              : "Ce rayon s'enrichira au fur et à mesure de l'indexation du catalogue."}
          </p>
        </div>
        <div className="absolute right-[-20px] bottom-[-30px] opacity-10 pointer-events-none hidden md:block">
          <BookOpen className="w-56 h-56 text-white" />
        </div>
      </div>

      {/* Sous-thèmes du rayon */}
      {childCounts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {childCounts.map((child) => (
            <Link
              key={child.code}
              href={`/books/themes/${child.code}`}
              className="px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:border-[#6D28D9] hover:text-[#6D28D9] transition-colors shadow-xs"
            >
              {child.name}
              <span className="ml-1.5 text-[10px] text-gray-400">{child.count}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Grille des livres du rayon */}
      {result.ok && result.data.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {result.data.map((book) => (
              <BookCatalogCard key={book.id} book={book} view="grid" />
            ))}
          </div>

          {/* Pagination */}
          {result.lastPage > 1 && (
            <div className="flex items-center justify-center gap-3 mt-10">
              {page > 1 ? (
                <Link
                  href={`/books/themes/${code}?page=${page - 1}`}
                  className="p-2.5 border border-gray-200 bg-white rounded-xl hover:bg-gray-50 transition-colors"
                  title="Page précédente"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Link>
              ) : (
                <span className="p-2.5 border border-gray-100 bg-white rounded-xl opacity-40">
                  <ChevronLeft className="w-4 h-4" />
                </span>
              )}
              <span className="px-4 py-2.5 bg-[#1a0a40] text-white text-xs font-bold rounded-xl shadow-xs">
                Page {page} sur {result.lastPage}
              </span>
              {page < result.lastPage ? (
                <Link
                  href={`/books/themes/${code}?page=${page + 1}`}
                  className="p-2.5 border border-gray-200 bg-white rounded-xl hover:bg-gray-50 transition-colors"
                  title="Page suivante"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              ) : (
                <span className="p-2.5 border border-gray-100 bg-white rounded-xl opacity-40">
                  <ChevronRight className="w-4 h-4" />
                </span>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="bg-white border border-gray-150 rounded-2xl p-12 text-center shadow-xs">
          <div className="w-16 h-16 bg-violet-50 text-[#6D28D9] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-black text-gray-900 mb-2">Aucun livre dans ce rayon</h2>
          <p className="text-xs sm:text-sm text-gray-500 mb-6">
            Ce rayon sera alimenté au fur et à mesure de l&apos;enrichissement du catalogue.
          </p>
          <Link
            href="/books"
            className="px-5 py-2.5 bg-[#6D28D9] text-white rounded-xl font-bold text-xs hover:bg-violet-800 transition-all shadow-xs inline-flex items-center gap-1.5"
          >
            Retour au catalogue
          </Link>
        </div>
      )}
    </div>
  );
}
