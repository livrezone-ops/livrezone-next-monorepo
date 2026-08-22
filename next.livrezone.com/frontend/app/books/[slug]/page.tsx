import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BookOpen, ArrowLeft } from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";

export const revalidate = 60;

const API_BASE = (process.env.INTERNAL_API_URL
  || process.env.NEXT_PUBLIC_API_URL
  || "https://api-next.livrezone.com").replace(/\/api\/?$/, "");

async function getBookDetails(slug: string) {
  // Extract ID or ISBN from the slug (e.g., 42-978123-harry-potter -> 42)
  const identifier = slug.split('-')[0];
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
  const description = `Découvrez les annonces pour le livre ${book.title}${book.authors ? ` de ${book.authors}` : ''} sur LivreZone Maroc.`;

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

  return (
    <div className="w-[90%] max-w-7xl mx-auto py-8">
      <Breadcrumbs items={[
        { label: "Catalogue des livres", href: "/books" },
        { label: book.title || "Détails" }
      ]} />

      <Link href="/books" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-black mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Retour au catalogue
      </Link>

      <div className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-10 shadow-sm flex flex-col md:flex-row gap-10">
        {/* Colonne Image */}
        <div className="w-full md:w-1/3 max-w-sm shrink-0 mx-auto md:mx-0">
          <div className="relative w-full pb-[140%] overflow-hidden rounded-xl bg-gray-50 border border-gray-100">
            {(book.cover_thumbnail_url || book.cover_url) ? (
              <Image
                src={book.cover_thumbnail_url || book.cover_url || ""}
                alt={book.title || ""}
                fill
                className="object-contain p-4 shadow-xs"
                unoptimized
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                <BookOpen className="w-24 h-24 stroke-1" />
              </div>
            )}
          </div>
        </div>

        {/* Colonne Détails */}
        <div className="flex-1 min-w-0 flex flex-col">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-2 leading-tight">
            {book.title}
          </h1>
          
          {book.authors && (
            <p className="text-lg text-gray-600 mb-6">
              De <span className="font-bold text-gray-800">{book.authors}</span>
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 bg-gray-50 p-5 rounded-xl border border-gray-100">
            {book.isbn_13 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">ISBN-13</p>
                <p className="text-sm font-mono text-gray-900">{book.isbn_13}</p>
              </div>
            )}
            {book.publisher && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Éditeur</p>
                <p className="text-sm text-gray-900">{book.publisher}</p>
              </div>
            )}
            {book.publication_date && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Date de publication</p>
                <p className="text-sm text-gray-900">{new Date(book.publication_date).toLocaleDateString('fr-FR')}</p>
              </div>
            )}
            {book.page_count && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Nombre de pages</p>
                <p className="text-sm text-gray-900">{book.page_count} pages</p>
              </div>
            )}
          </div>

          {book.description && (
            <div className="mb-8">
              <h2 className="text-lg font-bold text-gray-900 mb-3">Résumé</h2>
              <p className="text-gray-600 leading-relaxed text-sm sm:text-base whitespace-pre-line">
                {book.description}
              </p>
            </div>
          )}

          <div className="mt-auto pt-6 border-t border-gray-100 flex flex-col sm:flex-row gap-4">
            <Link
              href={`/annonces?search=${encodeURIComponent(book.isbn_13 || book.title)}`}
              className="flex-1 bg-[#1a0a40] hover:bg-[#6D28D9] text-white text-center font-bold py-4 px-6 rounded-xl transition-all shadow-sm"
            >
              Voir les annonces pour ce livre
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
