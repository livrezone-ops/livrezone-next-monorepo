import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, ChevronLeft, ChevronRight, Layers, ArrowLeft } from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";
import BookCatalogCard from "@/components/BookCatalogCard";
import { getAuthorBySlug } from "@/lib/books-api";
import { toJsonLd } from "@/lib/safe-json-ld";

export const revalidate = 60;

const SITE_URL = "https://next.livrezone.com";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

async function getData(slug: string, page: number) {
  return getAuthorBySlug(slug, page, 24);
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const page = parseInt(firstParam(sp.page) || "1", 10) || 1;
  const result = await getData(slug, page);

  if (!result) return { title: "Auteur introuvable" };

  const title = `${result.author.name} — Livres de l'auteur`;
  const description = `Découvrez les titres de ${result.author.name} dans le catalogue LivreZone (${result.author.books_count} titre${result.author.books_count > 1 ? "s" : ""}) et les annonces disponibles à la vente.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/books/auteurs/${slug}` },
    openGraph: { title, description, type: "profile", locale: "fr_MA", siteName: "LivreZone" },
    robots: page > 1 ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function AuthorPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = parseInt(firstParam(sp.page) || "1", 10) || 1;

  const result = await getData(slug, page);
  if (!result) notFound();

  const { author, books, lastPage, currentPage } = result;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        name: author.name,
        url: `${SITE_URL}/books/auteurs/${author.slug}`,
      },
      ...(books.length > 0
        ? [
            {
              "@type": "ItemList",
              itemListElement: books.map((book, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: book.title || "Livre",
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <div className="w-[90%] max-w-7xl mx-auto py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(jsonLd) }}
      />

      <Breadcrumbs
        items={[
          { label: "Catalogue des livres", href: "/books" },
          { label: "Auteurs", href: "/books/auteurs" },
          { label: author.name },
        ]}
      />

      <Link
        href="/books/auteurs"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-black mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Tous les auteurs
      </Link>

      {/* En-tête auteur */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 shadow-xs flex items-center gap-5 mb-8">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 text-white flex items-center justify-center text-2xl sm:text-3xl font-black shrink-0">
          {author.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2 leading-tight">{author.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet-50 text-[#6D28D9] border border-violet-200 text-xs font-bold rounded-full">
              <BookOpen className="w-3.5 h-3.5" />
              {author.books_count} titre{author.books_count > 1 ? "s" : ""} au catalogue
            </span>
            <Link
              href={`/annonces?search=${encodeURIComponent(author.name)}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-full hover:bg-emerald-100 transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              Voir les annonces de cet auteur
            </Link>
          </div>
        </div>
      </div>

      {/* Grille des livres de l'auteur */}
      {books.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {books.map((book) => (
            <BookCatalogCard key={book.id} book={book} view="grid" />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-150 rounded-2xl p-12 text-center shadow-xs">
          <div className="w-16 h-16 bg-violet-50 text-[#6D28D9] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-black text-gray-900 mb-2">Aucun titre pour le moment</h2>
          <p className="text-xs sm:text-sm text-gray-500">
            Les titres de cet auteur seront ajoutés au fur et à mesure de l&apos;enrichissement du catalogue.
          </p>
        </div>
      )}

      {/* Pagination */}
      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-3 mt-10">
          {currentPage > 1 ? (
            <Link
              href={`/books/auteurs/${slug}?page=${currentPage - 1}`}
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
            Page {currentPage} sur {lastPage}
          </span>
          {currentPage < lastPage ? (
            <Link
              href={`/books/auteurs/${slug}?page=${currentPage + 1}`}
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
    </div>
  );
}
