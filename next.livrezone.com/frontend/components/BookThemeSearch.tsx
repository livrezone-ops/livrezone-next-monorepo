// Box de recherche du hero des pages /books/themes/{code} (composant client).
// Même comportement que la recherche de BooksHome : autocomplétion live via
// GET /books/autocomplete, mais RESTREINTE au rayon courant (param
// `categories=CODE`, supporté par l'API). La soumission recharge la page thème
// avec ?search=… (SSR : getBooks filtre categories + search côté Meilisearch).
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import api from "@/lib/axios";
import BookSuggestionsMenu, { type BookSuggestion } from "@/components/BookSuggestionsMenu";
import { findExactIsbnBook } from "@/lib/books-search";

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

  // Même UX que la vitrine /books (09/09) : Entrée + ISBN exact présent au
  // catalogue → fiche du livre directement (même hors rayon : correspondance
  // à 100 %). Sinon : recherche plein-texte RESTREINTE au rayon courant.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    const exact = await findExactIsbnBook(term);
    if (exact?.id) {
      router.push(`/books/${exact.id}`);
      return;
    }
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

      {/* Menu déroulant des suggestions (composant partagé, restreint au rayon) */}
      {showSuggestions && suggestions.length > 0 && (
        <BookSuggestionsMenu
          suggestions={suggestions}
          onPick={handleSuggestionClick}
          label="Suggestions dans ce rayon"
        />
      )}
    </div>
  );
}