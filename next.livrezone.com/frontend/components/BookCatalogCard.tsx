"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BookOpen, Tag, Bell, ArrowRight, ExternalLink } from "lucide-react";
import type { BookSearchItem } from "@/lib/books-api";

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

  const categoryName = book.category?.name_fr;
  const langName = book.language?.name_fr;
  const levelName = book.level?.name_fr;
  const bookHref = buildBookHref(book);

  const coverContent = cover ? (
    <img
      src={cover}
      alt={book.title || "Livre"}
      onError={() => setImgError(true)}
      className="w-full h-full object-cover"
    />
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

  /* VUE EN GRILLE (3 COLONNES) */
  return (
    <article className="group bg-white rounded-xl border border-gray-200/90 hover:border-[#6D28D9]/40 p-3.5 sm:p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between h-full">
      <div>
        {/* Top: Couverture + Infos */}
        <div className="flex gap-3 mb-3">
          {/* Couverture compacte */}
          <Link
            href={bookHref}
            className="w-20 sm:w-24 h-28 sm:h-34 bg-gray-50 rounded-lg shrink-0 border border-gray-150 overflow-hidden relative flex items-center justify-center group-hover:scale-[1.02] transition-transform cursor-pointer shadow-2xs"
            title="Consulter la fiche livre"
          >
            {coverContent}
          </Link>

          {/* Détails */}
          <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
            <div>
              {/* Titre */}
              <Link
                href={bookHref}
                className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 hover:text-[#6D28D9] transition-colors block cursor-pointer mb-1"
                title="Consulter la fiche livre"
              >
                {book.title || "Titre non renseigné"}
              </Link>

              {/* Auteur */}
              {author && (
                <p className="text-xs text-gray-600 mb-1 line-clamp-1">
                  De : <span className="font-semibold text-gray-800">{author}</span>
                </p>
              )}

              {/* ISBN & Langue */}
              {(book.isbn_13 || langName) && (
                <div className="flex flex-wrap items-center gap-1 text-[11px] text-gray-500 mb-1">
                  {book.isbn_13 && (
                    <span className="font-mono text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200 text-[10px]">
                      ISBN: {book.isbn_13}
                    </span>
                  )}
                  {book.isbn_13 && langName && <span className="text-gray-300">·</span>}
                  {langName && (
                    <span className="text-gray-600 font-medium">
                      {langName}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Badges Catégorie & Niveau : Alignés tout en bas au niveau du bas de la photo */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
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
          </div>
        </div>
      </div>

      {/* Bottom: Bouton d'action principal */}
      <div className="mt-1 pt-2.5 border-t border-gray-100 flex items-center justify-end gap-2">
        {onRequestBook ? (
          <button
            type="button"
            onClick={() => onRequestBook(book)}
            className="h-8 px-3 rounded-lg bg-violet-50 text-[#6D28D9] hover:bg-[#6D28D9] hover:text-white transition-all text-xs font-bold flex items-center gap-1.5 border border-violet-200 shadow-2xs cursor-pointer"
            title="Déposer une demande pour ce livre"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Demander ce livre</span>
          </button>
        ) : (
          <Link
            href={`/demandes?search=${encodeURIComponent(book.title || "")}`}
            className="h-8 px-3 rounded-lg bg-violet-50 text-[#6D28D9] hover:bg-[#6D28D9] hover:text-white transition-all text-xs font-bold flex items-center gap-1.5 border border-violet-200 shadow-2xs cursor-pointer"
            title="Demander ce livre"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Demander</span>
          </Link>
        )}
      </div>
    </article>
  );
}
