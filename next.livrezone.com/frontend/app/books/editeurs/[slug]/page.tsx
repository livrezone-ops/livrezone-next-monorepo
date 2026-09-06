import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import BookCatalogCard from "@/components/BookCatalogCard";
import { getBooks, getPublisher } from "@/lib/books-api";
import { SITE_URL } from "@/lib/site-url";
import { ogDefaults } from "@/lib/og";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const page = parseInt((Array.isArray(sp.page) ? sp.page[0] : sp.page) || "1", 10) || 1;
  const publisher = await getPublisher(slug);

  if (!publisher) {
    return { title: "Éditeur introuvable" };
  }

  const canonical = `${SITE_URL}/books/editeurs/${slug}`;

  return {
    title: `${publisher.name} — Éditeur`,
    description: `Les livres de l'éditeur ${publisher.name} dans le catalogue LivreZone : ${publisher.books_count} titres référencés, ISBN, résumés et annonces disponibles à la vente au Maroc.`,
    alternates: { canonical },
    openGraph: {
      title: `${publisher.name} — Éditeur`,
      description: `${publisher.books_count} titres de l'éditeur ${publisher.name} dans le catalogue LivreZone.`,
      type: "website",
      ...ogDefaults(),
      url: canonical,
    },
    // Hub éditeur indexable dès qu'il a une valeur de navigation (≥ 3 livres) ;
    // en dessous, noindex follow pour éviter les pages quasi vides dans l'index.
    robots:
      publisher.books_count < 3 || page > 1
        ? { index: false, follow: true }
        : { index: true, follow: true },
  };
}

export default async function PublisherPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = parseInt((Array.isArray(sp.page) ? sp.page[0] : sp.page) || "1", 10) || 1;
  const publisher = await getPublisher(slug);

  if (!publisher) return notFound();

  const result = await getBooks({
    publisher: publisher.name,
    page,
    limit: 24,
    facets: false,
  });

  const totalPages = result.lastPage;

  return (
    <div className="w-[92%] max-w-6xl mx-auto py-8">
      <Breadcrumbs
        items={[
          { label: "Catalogue des livres", href: "/books" },
          { label: "Éditeurs", href: "/books/editeurs" },
          { label: publisher.name },
        ]}
      />
      <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">
        {publisher.name}
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        {publisher.books_count} {publisher.books_count > 1 ? "livres référencés" : "livre référencé"}{" "}
        dans le catalogue LivreZone.
      </p>

      {result.data.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {result.data.map((book) => (
            <BookCatalogCard key={book.id} book={book} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">
          Aucun livre de cet éditeur dans le catalogue pour le moment.
        </p>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-8 text-sm font-bold">
          {page > 1 ? (
            <Link
              href={`/books/editeurs/${slug}?page=${page - 1}`}
              className="px-4 py-2 rounded-xl border border-gray-200 hover:border-[#6D28D9] transition-colors"
            >
              ← Page {page - 1}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-gray-500">
            Page {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`/books/editeurs/${slug}?page=${page + 1}`}
              className="px-4 py-2 rounded-xl border border-gray-200 hover:border-[#6D28D9] transition-colors"
            >
              Page {page + 1} →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
