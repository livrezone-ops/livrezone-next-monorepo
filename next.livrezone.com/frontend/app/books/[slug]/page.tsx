import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BookOpen, ArrowLeft, Layers } from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";
import OrderBookButton from "./OrderBookButton";
import { slugifyAuthor } from "@/lib/author-slug";

function normalizeAuthors(authors: string[] | string | null | undefined): string[] {
  if (!authors) return [];
  const list = Array.isArray(authors) ? authors : String(authors).split(",");
  return list.map((a) => a.trim()).filter(Boolean);
}

export const revalidate = 60;

const API_BASE = (process.env.INTERNAL_API_URL
  || process.env.NEXT_PUBLIC_API_URL
  || "https://api-next.livrezone.com").replace(/\/api\/?$/, "");

async function getBookDetails(slug: string) {
  // Extract ID or ISBN from the slug (e.g., 42-978123-harry-potter -> 42)
  const identifier = slug.split("-")[0];
  if (!identifier) return null;

  try {
    const res = await fetch(`${API_BASE}/api/books/${identifier}`, {
      next: { revalidate: 60 },
      headers: { Accept: "application/json", Host: "api-next.livrezone.com" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.book;
  } catch {
    return null;
  }
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const book = await getBookDetails(slug);

  if (!book) return { title: "Livre introuvable | LivreZone" };

  const title = `${book.title} | LivreZone`;
  const description = `Découvrez les annonces pour le livre ${book.title}${book.authors ? ` de ${book.authors}` : ""} sur LivreZone Maroc.`;

  return {
    title,
    description,
    openGraph: { title, description, type: "book" },
  };
}

export default async function BookDetailsPage({ params }: PageProps) {
  const { slug } = await params;
  const book = await getBookDetails(slug);

  if (!book) return notFound();

  const listingsCount = book.active_listings_count ?? 0;

  return (
    <div className="w-[92%] max-w-6xl mx-auto py-8">
      <Breadcrumbs
        items={[
          { label: "Catalogue des livres", href: "/books" },
          { label: book.title || "Détails" },
        ]}
      />

      <Link
        href="/books"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-black mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour au catalogue
      </Link>

      <div className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row gap-8">
        {/* Colonne Image */}
        <div className="w-full md:w-1/3 max-w-xs shrink-0 mx-auto md:mx-0">
          <div className="relative w-full pb-[135%] overflow-hidden rounded-xl bg-gray-50 border border-gray-100">
            {book.cover_thumbnail_url || book.cover_url ? (
              <Image
                src={book.cover_thumbnail_url || book.cover_url || ""}
                alt={book.title || ""}
                fill
                className="object-contain p-4"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                <BookOpen className="w-20 h-20 stroke-1" />
              </div>
            )}
          </div>
        </div>

        {/* Colonne Détails */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {listingsCount > 0 ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-full">
                <Layers className="w-3.5 h-3.5" />
                {listingsCount} {listingsCount > 1 ? "annonces disponibles" : "annonce disponible"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-full">
                0 annonce en vente actuellement
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2 leading-tight">
            {book.title}
          </h1>

          {book.authors && normalizeAuthors(book.authors).length > 0 && (
            <p className="text-sm sm:text-base text-gray-600 mb-6">
              De{" "}
              {normalizeAuthors(book.authors).map((name, i) => (
                <span key={name}>
                  {i > 0 && ", "}
                  <Link
                    href={`/books/auteurs/${slugifyAuthor(name)}`}
                    className="font-bold text-gray-800 hover:text-[#6D28D9] transition-colors"
                    title={`Voir les livres de ${name}`}
                  >
                    {name}
                  </Link>
                </span>
              ))}
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 mb-6 bg-gray-50/70 p-4 rounded-xl border border-gray-100">
            {book.isbn_13 && (
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">ISBN-13</p>
                <p className="text-xs sm:text-sm font-mono text-gray-900 font-semibold">{book.isbn_13}</p>
              </div>
            )}
            {book.publisher && (
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Éditeur</p>
                <p className="text-xs sm:text-sm text-gray-900 font-semibold">{book.publisher}</p>
              </div>
            )}
            {book.publication_date && (
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Date de publication</p>
                <p className="text-xs sm:text-sm text-gray-900">{new Date(book.publication_date).toLocaleDateString("fr-FR")}</p>
              </div>
            )}
            {book.page_count && (
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Pages</p>
                <p className="text-xs sm:text-sm text-gray-900">{book.page_count} pages</p>
              </div>
            )}
          </div>

          {book.description && (
            <div className="mb-6">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">Résumé</h2>
              <p className="text-gray-600 leading-relaxed text-xs sm:text-sm whitespace-pre-line max-h-48 overflow-y-auto pr-2">
                {book.description}
              </p>
            </div>
          )}

          {/* Boutons d'action standards */}
          <div className="mt-auto pt-6 border-t border-gray-100 flex flex-wrap items-center gap-3">
            <Link
              href={`/annonces?search=${encodeURIComponent(book.isbn_13 || book.title)}`}
              className="px-4 py-2.5 bg-[#1a0a40] hover:bg-[#6D28D9] text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5"
            >
              <Layers className="w-4 h-4" />
              Voir les annonces ({listingsCount})
            </Link>

            <OrderBookButton bookId={book.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
