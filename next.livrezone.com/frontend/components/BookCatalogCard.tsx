"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { BookOpen, Tag, Bell, ArrowRight, Layers } from "lucide-react";
import type { BookSearchItem } from "@/lib/books-api";
import { slugifyAuthor } from "@/lib/author-slug";

/** Libellés de référence à ne jamais afficher en tag (ex. niveau id 18). */
const NOT_APPLICABLE_RE = /^(n\/?a|non applicable)$/i;
function displayableTag(value?: string | null): string | null {
  const v = value?.trim();
  return v && !NOT_APPLICABLE_RE.test(v) ? v : null;
}

/** L'optimiseur next/image ne sait servir que les hôtes de remotePatterns. */
function isOptimizableCover(url: string): boolean {
  return url.startsWith("/")
    || url.startsWith("https://api-next.livrezone.com")
    || url.startsWith("http://localhost");
}

function buildBookHref(book: BookSearchItem): string {
  const slug = (book.title || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return `/books/${book.id}${book.isbn_13 ? "-" + book.isbn_13 : ""}${slug ? "-" + slug : ""}`;
}

interface BookCatalogCardProps {
  book: BookSearchItem;
  view?: "grid" | "list";
  onRequestBook?: (book: BookSearchItem) => void;
}

export default function BookCatalogCard({
  book,
  view = "list",
  onRequestBook,
}: BookCatalogCardProps) {
  const [imgError, setImgError] = useState(false);

  const cover = !imgError
    ? (book.cover_thumbnail_url_320 || book.cover_thumbnail_url || book.cover_url || null)
    : (book.cover_url || null);

  const author = book.authors
    ? Array.isArray(book.authors)
      ? book.authors.join(", ")
      : book.authors
    : null;

  // Liste d'auteurs normalisée (chaque nom devient un lien vers sa page auteur).
  const authorsList: string[] = book.authors
    ? Array.isArray(book.authors)
      ? book.authors.map((a) => String(a).trim()).filter(Boolean)
      : String(book.authors)
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean)
    : [];

  const listingsCount = book.active_listings_count ?? 0;

  const categoryName = displayableTag(book.category?.name_fr);
  const langName = displayableTag(book.language?.name_fr);
  const levelName = displayableTag(book.level?.name_fr);
  const bookHref = buildBookHref(book);

  const coverContent = cover ? (
    isOptimizableCover(cover) ? (
      <Image
        src={cover}
        alt={book.title || "Livre"}
        fill
        sizes="(max-width: 640px) 40vw, (max-width: 1024px) 30vw, 300px"
        onError={() => setImgError(true)}
        className="w-full h-full object-cover"
      />
    ) : (
      /* URL externe (hors remotePatterns) : <img> natif, chargement différé. */
      <img
        src={cover}
        alt={book.title || "Livre"}
        loading="lazy"
        decoding="async"
        onError={() => setImgError(true)}
        className="w-full h-full object-cover"
      />
    )
  ) : (
    <div className="flex flex-col items-center justify-center text-gray-300 gap-1 p-2 text-center h-full">
      <BookOpen className="w-6 h-6 stroke-1" />
      <span className="text-[9px] font-bold text-gray-400">Livre</span>
    </div>
  );

  if (view === "list") {
    /* VUE EN LIGNE (COMPACTE COMME LES ANNONCES) */
    return (
      <article className="group bg-white rounded-xl border border-gray-100 hover:border-[#6D28D9]/40 p-3 shadow-xs hover:shadow-md transition-all flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 flex-1 min-w-0">
          {/* Couverture miniature 16x20 */}
          <Link
            href={bookHref}
            className="w-16 h-20 bg-gray-50 rounded-lg shrink-0 border border-gray-150 overflow-hidden relative flex items-center justify-center group-hover:scale-105 transition-transform cursor-pointer shadow-2xs"
            title="Consulter la fiche livre"
          >
            {coverContent}
          </Link>

          {/* Informations compactes */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <Link
                href={bookHref}
                className="font-bold text-gray-900 text-sm group-hover:text-[#6D28D9] transition-colors truncate max-w-md"
                title="Consulter la fiche livre"
              >
                {book.title || "Titre non renseigné"}
              </Link>
            </div>

            {author && (
              <p className="text-xs text-gray-500 truncate mb-1">
                De : <span className="text-gray-700 font-medium">{author}</span>
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {categoryName && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6D28D9] bg-violet-50 px-2 py-0.5 rounded-md">
                  <Tag className="w-3 h-3 text-[#6D28D9] shrink-0" />
                  <span>{categoryName}</span>
                </span>
              )}

              {langName && (
                <span className="text-[11px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">
                  {langName}
                </span>
              )}

              {levelName && (
                <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md hidden sm:inline">
                  {levelName}
                </span>
              )}

              {book.isbn_13 && (
                <span className="text-[11px] text-gray-400 font-mono hidden md:inline">
                  ISBN: {book.isbn_13}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Disponibilité & Actions à droite */}
        <div className="flex items-center gap-3 shrink-0">
          {onRequestBook ? (
            <button
              type="button"
              onClick={() => onRequestBook(book)}
              className="h-8.5 px-3 rounded-lg bg-violet-50 text-[#6D28D9] hover:bg-[#6D28D9] hover:text-white transition-all text-xs font-bold flex items-center gap-1.5 border border-violet-200 shadow-2xs cursor-pointer"
              title="Déposer une demande pour ce livre"
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Demander ce livre</span>
            </button>
          ) : (
            <Link
              href={`/demandes?search=${encodeURIComponent(book.title || "")}`}
              className="h-8.5 px-3 rounded-lg bg-violet-50 text-[#6D28D9] hover:bg-[#6D28D9] hover:text-white transition-all text-xs font-bold flex items-center gap-1.5 border border-violet-200 shadow-2xs cursor-pointer"
              title="Rechercher ou déposer une demande"
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Demander</span>
            </Link>
          )}

          <Link
            href={bookHref}
            className="w-8.5 h-8.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-[#6D28D9] hover:text-white transition-all flex items-center justify-center cursor-pointer shadow-2xs"
            title="Consulter la fiche détaillée"
          >
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </article>
    );
  }

  /* VUE EN GRILLE (carte verticale type librairie en ligne) */
  return (
    <article className="group bg-white rounded-xl border border-gray-200/90 hover:border-[#6D28D9]/40 shadow-xs hover:shadow-md transition-all flex flex-col h-full overflow-hidden">
      {/* Couverture pleine largeur (ratio 2:3) */}
      <Link
        href={bookHref}
        className="relative block w-full aspect-[2/3] bg-gray-50 overflow-hidden group-hover:opacity-95 transition-opacity"
        title="Consulter la fiche livre"
      >
        {coverContent}
        {listingsCount > 0 && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/95 text-white text-[10px] font-bold shadow-sm">
            <Layers className="w-3 h-3" />
            {listingsCount} en vente
          </span>
        )}
      </Link>

      {/* Infos */}
      <div className="flex flex-col flex-1 p-3 pt-2.5">
        {/* Titre */}
        <Link
          href={bookHref}
          className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 hover:text-[#6D28D9] transition-colors mb-1"
          title="Consulter la fiche livre"
        >
          {book.title || "Titre non renseigné"}
        </Link>

        {/* Auteurs (liens vers les pages auteurs) */}
        {authorsList.length > 0 && (
          <p className="text-xs text-gray-500 line-clamp-1 mb-2">
            <span className="text-gray-400">De : </span>
            {authorsList.slice(0, 2).map((name, i) => (
              <React.Fragment key={`${name}-${i}`}>
                {i > 0 && ", "}
                <Link
                  href={`/books/auteurs/${slugifyAuthor(name)}`}
                  className="font-semibold text-gray-700 hover:text-[#6D28D9] transition-colors"
                >
                  {name}
                </Link>
              </React.Fragment>
            ))}
            {authorsList.length > 2 && ` +${authorsList.length - 2}`}
          </p>
        )}

        {/* Badges Catégorie & Niveau */}
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          {categoryName && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6D28D9] bg-violet-50 border border-violet-200/80 px-2 py-0.5 rounded-md">
              <Tag className="w-3 h-3 text-[#6D28D9] shrink-0" />
              <span className="truncate max-w-[110px]">{categoryName}</span>
            </span>
          )}
          {levelName && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
              <span>{levelName}</span>
            </span>
          )}
        </div>

        {/* Bottom: Bouton d'action principal */}
        <div className="mt-auto pt-2.5 border-t border-gray-100">
          {onRequestBook ? (
            <button
              type="button"
              onClick={() => onRequestBook(book)}
              className="w-full h-8 px-3 rounded-lg bg-violet-50 text-[#6D28D9] hover:bg-[#6D28D9] hover:text-white transition-all text-xs font-bold flex items-center justify-center gap-1.5 border border-violet-200 shadow-2xs cursor-pointer"
              title="Déposer une demande pour ce livre"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Demander ce livre</span>
            </button>
          ) : (
            <Link
              href={`/demandes?search=${encodeURIComponent(book.title || "")}`}
              className="w-full h-8 px-3 rounded-lg bg-violet-50 text-[#6D28D9] hover:bg-[#6D28D9] hover:text-white transition-all text-xs font-bold flex items-center justify-center gap-1.5 border border-violet-200 shadow-2xs cursor-pointer"
              title="Demander ce livre"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Demander</span>
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
