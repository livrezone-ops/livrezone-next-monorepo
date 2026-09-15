// Menu déroulant partagé des suggestions d'autocomplétion du catalogue (09/09).
// Extrait de BooksHome / BooksClient / BookThemeSearch (markup identique ×3) :
// vignette + titre + auteur + ISBN, clic → onPick (fiche livre ou pré-remplissage).
// NB : le parent doit être en `relative` et ne doit PAS être dans un conteneur
// `overflow-hidden` — le dropdown (z-50) doit pouvoir dépasser le bandeau hero.
"use client";

import React from "react";
import SmartCoverImage from "@/components/SmartCoverImage";
import { BookOpen, ArrowRight } from "lucide-react";

export interface BookSuggestion {
  id?: number;
  title?: string;
  isbn_13?: string;
  cover_thumbnail_url?: string | null;
  cover_url?: string | null;
  authors?: string[] | string | null;
}

export default function BookSuggestionsMenu({
  suggestions,
  onPick,
  label = "Suggestions de livres",
}: {
  suggestions: BookSuggestion[];
  onPick: (item: BookSuggestion) => void;
  label?: string;
}) {
  return (
    <div className="absolute left-0 right-0 top-[calc(100%+6px)] bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto animate-in slide-in-from-top-2 duration-150">
      <div className="p-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider px-3 border-b border-gray-100">
        {label}
      </div>
      <ul className="py-1">
        {suggestions.map((item) => {
          const cover = item.cover_thumbnail_url || item.cover_url || null;
          const authorLabel = item.authors
            ? Array.isArray(item.authors)
              ? item.authors.join(", ")
              : item.authors
            : null;
          return (
            <li
              key={item.id || item.isbn_13}
              onClick={() => onPick(item)}
              className="px-3.5 py-2 hover:bg-violet-50/60 cursor-pointer flex items-center gap-3 transition-colors border-b border-gray-50 last:border-0 group"
            >
              <div className="w-10 h-13 bg-gray-100 rounded-md shrink-0 overflow-hidden relative border border-gray-200/80 flex items-center justify-center">
                {cover ? (
                  <SmartCoverImage src={cover} alt="" className="object-cover" sizes="40px" />
                ) : (
                  <BookOpen className="w-4 h-4 text-gray-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900 truncate group-hover:text-[#6D28D9] transition-colors">
                  {item.title}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                  {authorLabel && <span className="truncate max-w-[200px]">De : {authorLabel}</span>}
                  {item.isbn_13 && (
                    <span className="text-[10px] font-mono text-gray-400 hidden sm:inline">
                      · ISBN : {item.isbn_13}
                    </span>
                  )}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#6D28D9] group-hover:translate-x-0.5 transition-all shrink-0" />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
