// Box de recherche du hero des pages /books/themes/{code} (composant client).
// Même comportement que la recherche de BooksHome : autocomplétion live via
// GET /books/autocomplete, mais RESTREINTE au rayon courant (param
// `categories=CODE`, supporté par l'API). La soumission recharge la page thème
// avec ?search=… (SSR : getBooks filtre categories + search côté Meilisearch).
"use client";

import React, { useState, useEffect, useRef } from "react";
import SmartCoverImage from "@/components/SmartCoverImage";
import { useRouter } from "next/navigation";
import { Search, Loader2, BookOpen, ArrowRight } from "lucide-react";
import api from "@/lib/axios";

interface BookSuggestion {
  id?: number;
  title?: string;
  isbn_13?: string;
  cover_thumbnail_url?: string | null;
  cover_url?: string | null;
  authors?: string[] | string | null;
}

export default function BookThemeSearch({ themeCode }: { themeCode: string }) {
  const router = useRouter();
  const [term, setTerm] = useState("");

  const [suggestions, setSuggestions] = useState<BookSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Autocomplétion live, filtrée sur le rayon courant (categories=CODE).
  useEffect(() => {
    const timer = setTimeout(async () => {
      const q = term.trim();
      if (q.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      setIsSearching(true);
      try {
        const { data } = await api.get(
          `/books/autocomplete?q=${encodeURIComponent(q)}&limit=6&categories=${encodeURIComponent(themeCode)}`
        );
        setSuggestions(Array.isArray(data) ? (data as BookSuggestion[]) : []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [term, themeCode]);

  // Fermeture du menu au clic extérieur ou avec Échap.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    const search = term.trim();
    router.push(search ? `/books/themes/${themeCode}?search=${encodeURIComponent(search)}` : `/books/themes/${themeCode}`);
  };

  const handleSuggestionClick = (item: BookSuggestion) => {
    setShowSuggestions(false);
    if (item.id) {
      router.push(`/books/${item.id}`);
    } else {
      setTerm(item.title || item.isbn_13 || "");
    }
  };

  return (
    <div ref={searchContainerRef} className="relative mt-4">
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="search"
              name="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              placeholder="Rechercher dans ce rayon (titre, auteur, ISBN)…"
              aria-label="Rechercher un livre dans ce rayon"
              autoComplete="off"
              className="w-full rounded-xl border-0 px-4 py-3 pr-10 text-sm text-gray-900 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
            {isSearching && (
              <Loader2 className="w-4 h-4 text-gray-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
            )}
          </div>
          <button
            type="submit"
            className="bg-white text-[#1a0a40] hover:bg-violet-50 font-bold px-6 py-3 rounded-xl text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4" />
            Rechercher
          </button>
        </div>
      </form>

      {/* Menu déroulant des suggestions (live, restreint au rayon) */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto animate-in slide-in-from-top-2 duration-150">
          <div className="p-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider px-3 border-b border-gray-100">
            Suggestions de livres
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
                  onClick={() => handleSuggestionClick(item)}
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
      )}
    </div>
  );
}