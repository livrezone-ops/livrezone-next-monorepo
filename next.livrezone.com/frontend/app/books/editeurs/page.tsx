import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import { getPublishersPage } from "@/lib/books-api";
import { SITE_URL } from "@/lib/site-url";
import { ogDefaults } from "@/lib/og";

export const revalidate = 86400;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sp = await searchParams;
  const page = parseInt((Array.isArray(sp.page) ? sp.page[0] : sp.page) || "1", 10) || 1;
  const canonical = `${SITE_URL}/books/editeurs`;

  return {
    title: "Éditeurs du catalogue",
    description:
      "Parcourez le catalogue LivreZone par maison d'édition : des dizaines de milliers d'éditeurs, des centaines de milliers de livres référencés au Maroc.",
    alternates: { canonical },
    openGraph: {
      title: "Éditeurs du catalogue",
      description:
        "Parcourez le catalogue LivreZone par maison d'édition : des dizaines de milliers d'éditeurs, des centaines de milliers de livres référencés au Maroc.",
      type: "website",
      ...ogDefaults(),
      url: canonical,
    },
    // Pagination de l'annuaire : noindex follow (les hubs éditeurs individuels
    // sont indexables, pas les pages de liens purs).
    robots: page > 1 ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function EditeursPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = parseInt((Array.isArray(sp.page) ? sp.page[0] : sp.page) || "1", 10) || 1;
  const result = await getPublishersPage(page);

  if (!result) return notFound();

  const totalPages = result.last_page;

  return (
    <div className="w-[92%] max-w-6xl mx-auto py-8">
      <Breadcrumbs
        items={[
          { label: "Catalogue des livres", href: "/books" },
          { label: "Éditeurs" },
        ]}
      />
      <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">
        Éditeurs du catalogue
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        {result.total} maisons d&apos;édition — cliquez sur un éditeur pour voir
        ses livres référencés.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {result.data.map((publisher) => (
          <Link
            key={publisher.slug}
            href={`/books/editeurs/${publisher.slug}`}
            className="flex items-center justify-between gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 hover:border-[#6D28D9] hover:shadow-xs transition-all"
          >
            <span className="text-sm font-bold text-gray-800 truncate">
              {publisher.name}
            </span>
            <span className="text-xs text-gray-400 shrink-0">
              {publisher.books_count} {publisher.books_count > 1 ? "livres" : "livre"}
            </span>
          </Link>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-8 text-sm font-bold">
          {page > 1 ? (
            <Link
              href={`/books/editeurs?page=${page - 1}`}
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
              href={`/books/editeurs?page=${page + 1}`}
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
