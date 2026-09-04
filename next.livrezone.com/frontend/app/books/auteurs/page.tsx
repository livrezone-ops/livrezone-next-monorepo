import type { Metadata } from "next";
import Link from "next/link";
import { Users, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";
import { getBookAuthors } from "@/lib/books-api";

export const revalidate = 300;

const SITE_URL = "https://next.livrezone.com";

type SearchParams = Record<string, string | string[] | undefined>;

interface PageProps {
  searchParams: Promise<SearchParams>;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sp = await searchParams;
  const letter = firstParam(sp.letter).toUpperCase();
  const page = parseInt(firstParam(sp.page) || "1", 10) || 1;

  const title = /^[A-Z]$/.test(letter) ? `Auteurs ${letter} — Catalogue des livres` : "Auteurs du catalogue";
  const description = /^[A-Z]$/.test(letter)
    ? `Découvrez les auteurs ${letter} du référentiel LivreZone et leurs titres disponibles à la vente ou sur demande.`
    : "Parcourez tous les auteurs du catalogue LivreZone : titres référencés, annonces disponibles et demandes de livres.";

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/books/auteurs${/^[A-Z]$/.test(letter) ? `?letter=${letter}` : ""}`,
    },
    openGraph: { title, description, type: "website", locale: "fr_MA", siteName: "LivreZone" },
    robots: page > 1 ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function AuthorsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const letterParam = firstParam(sp.letter).toUpperCase();
  const letter = /^[A-Z]$/.test(letterParam) ? letterParam : "all";
  const page = parseInt(firstParam(sp.page) || "1", 10) || 1;

  const result = await getBookAuthors({ letter, page, limit: 12 });

  const letters = Object.entries(result.letters || {});

  const buildHref = (l: string, p: number) =>
    `/books/auteurs?${l !== "all" ? `letter=${encodeURIComponent(l)}&` : ""}page=${p}`;

  return (
    <div className="w-[90%] max-w-7xl mx-auto py-8">
      <Breadcrumbs items={[{ label: "Catalogue des livres", href: "/books" }, { label: "Auteurs" }]} />

      {/* Bandeau */}
      <div className="bg-gradient-to-r from-[#1a0a40] via-[#2a1154] to-[#6D28D9] text-white rounded-2xl p-6 sm:p-8 shadow-md mb-8 relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-violet-200 text-xs font-bold mb-3 border border-white/15 backdrop-blur-xs">
            <Users className="w-3.5 h-3.5 text-violet-300" />
            <span>Index des auteurs</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2.5">
            Auteurs du catalogue
          </h1>
          <p className="text-sm sm:text-base text-violet-100/90 leading-relaxed font-normal">
            {result.totalAuthors > 0
              ? `${result.totalAuthors.toLocaleString("fr-FR")} auteurs référencés dans le catalogue LivreZone.`
              : "Parcourez les auteurs du référentiel et retrouvez leurs titres."}
          </p>
        </div>
        <div className="absolute right-[-20px] bottom-[-30px] opacity-10 pointer-events-none hidden md:block">
          <Users className="w-56 h-56 text-white" />
        </div>
      </div>

      {/* Navigation A-Z */}
      {letters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-8">
          <Link
            href="/books/auteurs"
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              letter === "all"
                ? "bg-[#1a0a40] text-white shadow-xs"
                : "bg-white border border-gray-200 text-gray-600 hover:border-[#6D28D9] hover:text-[#6D28D9]"
            }`}
          >
            Tous
          </Link>
          {letters.map(([l, count]) => (
            <Link
              key={l}
              href={`/books/auteurs?letter=${encodeURIComponent(l)}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                letter === l
                  ? "bg-[#1a0a40] text-white shadow-xs"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-[#6D28D9] hover:text-[#6D28D9]"
              }`}
            >
              {l} <span className="text-[10px] opacity-60">{count}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Grille des auteurs */}
      {result.ok && result.data.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {result.data.map((author) => (
              <Link
                key={author.slug}
                href={`/books/auteurs/${author.slug}`}
                className="group flex items-center gap-3 bg-white rounded-xl border border-gray-200/90 p-3.5 shadow-xs hover:border-[#6D28D9]/40 hover:shadow-md transition-all"
              >
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 text-white flex items-center justify-center text-base font-black shrink-0">
                  {author.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900 truncate group-hover:text-[#6D28D9] transition-colors">
                    {author.name}
                  </p>
                  <p className="text-[11px] text-gray-400 font-bold">
                    {author.books_count} titre{author.books_count > 1 ? "s" : ""}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#6D28D9] transition-colors shrink-0" />
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {result.lastPage > 1 && (
            <div className="flex items-center justify-center gap-3 mt-10">
              {page > 1 ? (
                <Link
                  href={buildHref(letter, page - 1)}
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
                  href={buildHref(letter, page + 1)}
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
            <Users className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-black text-gray-900 mb-2">Aucun auteur trouvé</h2>
          <p className="text-xs sm:text-sm text-gray-500">
            Aucun auteur du catalogue ne correspond à cette sélection.
          </p>
        </div>
      )}
    </div>
  );
}
