import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { BookOpen } from "lucide-react";
import { getBooks, type BookSearchItem } from "@/lib/books-api";

export const revalidate = 60;

const SITE_URL = "https://next.livrezone.com";
const PATH = "/livres";

type SearchParams = Record<string, string | string[] | undefined>;

interface PageProps {
  searchParams: Promise<SearchParams>;
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
    : "Catalogue des livres au Maroc | LivreZone";
  const description = search
    ? `Recherchez « ${search} » dans le catalogue de livres de LivreZone : ISBN, titre, auteur.`
    : "Explorez le catalogue de livres de LivreZone : découvrez les livres disponibles au Maroc par ISBN, titre ou auteur.";

  return {
    title,
    description,
    alternates: { canonical: canonicalHref(search, page) },
    openGraph: { title, description, type: "website", locale: "fr_MA", siteName: "LivreZone" },
    robots:
      page > 1 ? { index: false, follow: true } : { index: true, follow: true },
  };
}

function authorText(book: BookSearchItem): string | null {
  if (!book.authors) return null;
  return Array.isArray(book.authors) ? book.authors.join(", ") : book.authors;
}

export default async function LivresPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const search = firstParam(sp.search);
  const page = parseInt(firstParam(sp.page) || "1", 10) || 1;

  const result = await getBooks({ search: search || undefined, page, limit: 24 });

  const jsonLdItemList =
    result.ok && result.data.length > 0
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
    <div className="w-[90%] max-w-7xl mx-auto py-8">
      <nav
        aria-label="Fil d'Ariane"
        className="mb-8 text-xs md:text-sm font-semibold text-gray-500 flex items-center gap-2 flex-wrap tracking-wide uppercase"
      >
        <Link href="/" className="hover:text-black transition-colors">
          Accueil
        </Link>
        <span>/</span>
        <span className="text-black font-semibold">Livres</span>
      </nav>

      <div className="pb-6 mb-6 border-b border-gray-100">
        <h1 className="text-3xl font-bold tracking-tight text-black mb-1">
          {search ? `Livres « ${search} »` : "Catalogue des livres"}
        </h1>
        {result.ok && (
          <p className="text-[13px] text-gray-500 font-medium">
            {result.total} {result.total > 1 ? "livres" : "livre"}
          </p>
        )}
      </div>

      <form
        action={PATH}
        method="get"
        className="flex max-w-xl mb-8 border border-gray-300 rounded-lg overflow-hidden h-11"
      >
        <input
          type="search"
          name="search"
          defaultValue={search}
          placeholder="Rechercher par ISBN, titre ou auteur"
          className="flex-1 px-4 text-sm focus:outline-none"
        />
        <button
          type="submit"
          className="bg-[#1a0a40] hover:bg-[#6D28D9] text-white font-bold px-5 text-sm transition-colors cursor-pointer"
        >
          Rechercher
        </button>
      </form>

      {result.ok && result.data.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {result.data.map((book) => (
              <article
                key={book.id}
                className="flex flex-col bg-white border border-gray-100 rounded-xl p-3 shadow-xs"
              >
                <div className="relative w-full pb-[130%] overflow-hidden rounded-md bg-gray-50">
                  {book.cover_url ? (
                    <Image
                      src={book.cover_url}
                      alt={book.title || ""}
                      fill
                      className="object-contain p-2"
                      unoptimized
                    />
                  ) : (
                    <div className="absolute left-0 top-0 flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
                      <BookOpen className="h-10 w-10 stroke-1" />
                    </div>
                  )}
                </div>
                <h2 className="line-clamp-2 mt-3 text-sm font-bold text-gray-900 leading-tight">
                  {book.title}
                </h2>
                {authorText(book) && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-1">{authorText(book)}</p>
                )}
                {book.publisher && (
                  <p className="text-[11px] text-gray-400 mt-0.5">{book.publisher}</p>
                )}
                {book.isbn_13 && (
                  <p className="text-[11px] text-gray-400 font-mono mt-0.5">{book.isbn_13}</p>
                )}
                <Link
                  href={`/annonces?search=${encodeURIComponent(book.isbn_13 || book.title || "")}`}
                  className="mt-3 text-[11px] font-bold text-[#6D28D9] hover:underline"
                >
                  Voir les annonces de ce livre →
                </Link>
              </article>
            ))}
          </div>

          {result.lastPage > 1 && (
            <nav
              aria-label="Pagination"
              className="flex justify-center items-center gap-2 mt-10 font-bold text-xs"
            >
              {page > 1 && (
                <Link
                  href={canonicalHref(search, page - 1).replace(SITE_URL, "")}
                  className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Précédent
                </Link>
              )}
              <span className="px-3 py-2 border border-[#1a0a40] bg-[#1a0a40] text-white rounded-lg">
                {page}
              </span>
              {page < result.lastPage && (
                <Link
                  href={canonicalHref(search, page + 1).replace(SITE_URL, "")}
                  className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Suivant
                </Link>
              )}
            </nav>
          )}
        </>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center shadow-xs">
          <BookOpen className="h-16 w-16 text-gray-300 stroke-1 mx-auto mb-4" />
          <h3 className="text-lg font-black text-gray-950 mb-1">
            Aucun livre trouvé
          </h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
            Nous n&apos;avons trouvé aucun livre correspondant à votre recherche.
          </p>
        </div>
      )}

      {jsonLdItemList && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdItemList) }}
        />
      )}
    </div>
  );
}