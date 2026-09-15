// Page d'accueil du catalogue — vitrine légère (décision propriétaire 03/09,
// enrichie le 06/09) : AUCUN appel serveur lourd. L'ancienne vitrine attendait
// /api/books/authors qui, cache froid, scanne les ~700 000 livres → timeout.
// Ici : recherche avec autocomplétion live (endpoint Meilisearch rapide,
// /books/autocomplete) + panneau « + Filtres » + section « Nouveautés »
// alimentée côté serveur par UNE requête Meilisearch plafonnée (12 titres,
// tri created_at desc, sans facettes — voir app/books/page.tsx).
"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import BookCatalogCard from "@/components/BookCatalogCard";
import BookSuggestionsMenu, { type BookSuggestion } from "@/components/BookSuggestionsMenu";
import { useRouter } from "next/navigation";
import { Search, Loader2, SlidersHorizontal, X } from "lucide-react";
import api from "@/lib/axios";
import { CATEGORIES, LEVELS, LANGUAGES } from "@/lib/reference-data";
import { findExactIsbnBook } from "@/lib/books-search";
import type { BookSearchItem } from "@/lib/books-api";

export default function BooksHome({ newBooks = [] }: { newBooks?: BookSearchItem[] }) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState("");
  const [language, setLanguage] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [suggestions, setSuggestions] = useState<BookSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Autocomplétion live (même endpoint que la vue recherche).
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
        const { data } = await api.get(`/books/autocomplete?q=${encodeURIComponent(q)}&limit=6`);
        setSuggestions(Array.isArray(data) ? (data as BookSuggestion[]) : []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [term]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    const rawTerm = term.trim();

    // ISBN exact (09/09, logique partagée lib/books-search) : si la saisie est
    // un ISBN présent au catalogue, Entrée ouvre directement la fiche du livre.
    // Sinon (ISBN inconnu, ou saisie non-ISBN) : recherche globale titre +
    // auteur + ISBN (Meilisearch multi-champs) avec l'ensemble des résultats.
    if (!author.trim()) {
      const exact = await findExactIsbnBook(rawTerm);
      if (exact?.id) {
        router.push(`/books/${exact.id}`);
        return;
      }
    }

    // Auteur : pas de paramètre dédié côté API — les termes sont fusionnés dans
    // la recherche (Meilisearch matche aussi les auteurs), ce qui combine
    // naturellement titre + auteur.
    const search = [rawTerm, author.trim()].filter(Boolean).join(" ");
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category) params.set("categories", category);
    if (level) params.set("levels", level);
    if (language) params.set("languages", language);
    const qs = params.toString();
    router.push(qs ? `/books?${qs}` : "/books");
  };

  const handleSuggestionClick = (item: BookSuggestion) => {
    setShowSuggestions(false);
    if (item.id) {
      router.push(`/books/${item.id}`);
    } else {
      setTerm(item.title || item.isbn_13 || "");
    }
  };

  // Entrée = recherche globale (09/09, nouvelle UX) : plus de sélection
  // automatique de la 1ʳᵉ suggestion — le clic sur une vignette reste le seul
  // moyen d'ouvrir une fiche depuis le menu d'autocomplétion.

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Hero + recherche — sans overflow-hidden : le dropdown
          d'autocomplétion (z-50) doit pouvoir dépasser le bandeau,
          sinon il est clippé et invisible (fix 08/09). */}
      <div className="bg-gradient-to-r from-[#1a0a40] via-[#2a1154] to-[#6D28D9] text-white rounded-2xl p-6 sm:p-8 shadow-md relative mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2.5">
          Catalogue &amp; Référentiel des livres
        </h1>
        <p className="text-sm sm:text-base text-violet-100/90 leading-relaxed mb-4 font-normal">
          Des centaines de milliers de titres référencés. Recherchez par titre,
          auteur ou ISBN, puis trouvez les annonces disponibles auprès des
          vendeurs LivreZone.
        </p>

        <div ref={searchContainerRef} className="relative">
          {/* Bouton « + Filtres » au-dessus de la barre de recherche */}
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 border border-white/30 rounded-lg px-3 py-1.5 transition-colors cursor-pointer"
            >
              {showFilters ? <X className="w-3.5 h-3.5" /> : <SlidersHorizontal className="w-3.5 h-3.5" />}
              {showFilters ? "Masquer les filtres" : "+ Filtres"}
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Panneau de filtres */}
            {showFilters && (
              <div className="bg-white/10 border border-white/20 rounded-xl p-3 sm:p-4 mb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-in slide-in-from-top-2 duration-150">
                <div>
                  <label htmlFor="bh-author" className="block text-[11px] font-bold text-violet-100/90 mb-1">
                    Auteur
                  </label>
                  <input
                    id="bh-author"
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Ex. : J. K. Rowling"
                    className="w-full rounded-lg border-0 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"
                  />
                </div>
                <div>
                  <label htmlFor="bh-category" className="block text-[11px] font-bold text-violet-100/90 mb-1">
                    Catégorie
                  </label>
                  <select
                    id="bh-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border-0 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 cursor-pointer"
                  >
                    <option value="">Toutes</option>
                    {CATEGORIES.map((family) => (
                      <optgroup key={family.code} label={family.name}>
                        <option value={family.code}>{family.name} — toute la famille</option>
                        {family.children?.map((child) => (
                          <option key={child.code} value={child.code}>
                            {child.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="bh-level" className="block text-[11px] font-bold text-violet-100/90 mb-1">
                    Niveau
                  </label>
                  <select
                    id="bh-level"
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className="w-full rounded-lg border-0 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 cursor-pointer"
                  >
                    <option value="">Tous</option>
                    {LEVELS.map((lvl) => (
                      <option key={lvl.code} value={lvl.code}>
                        {lvl.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="bh-language" className="block text-[11px] font-bold text-violet-100/90 mb-1">
                    Langue
                  </label>
                  <select
                    id="bh-language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full rounded-lg border-0 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 cursor-pointer"
                  >
                    <option value="">Toutes</option>
                    {LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Barre de recherche */}
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
                  placeholder="Titre, auteur, ISBN…"
                  aria-label="Rechercher un livre"
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

          {/* Menu déroulant des suggestions (composant partagé) */}
          {showSuggestions && suggestions.length > 0 && (
            <BookSuggestionsMenu suggestions={suggestions} onPick={handleSuggestionClick} />
          )}
        </div>
      </div>

      {/* Rayons (arbre statique, aucun appel API) — placés AVANT les
          nouveautés (demande propriétaire 06/09). */}
      <h2 className="text-lg font-black text-[#1a0a40] flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
        Explorer par rayon
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {CATEGORIES.map((family) => (
          <Link
            key={family.code}
            href={`/books/themes/${family.code}`}
            className="group bg-white border border-gray-200 rounded-xl px-4 py-3.5 shadow-sm hover:shadow-md hover:border-[#6D28D9] transition-all"
          >
            <p className="text-sm font-black text-gray-900 group-hover:text-[#6D28D9] transition-colors">
              {family.name}
            </p>
            <p className="text-[11px] font-bold text-gray-400 mt-0.5">
              {family.children?.length
                ? `${family.children.length} sous-rayons`
                : "Voir les livres"}
            </p>
          </Link>
        ))}
      </div>

      {/* Nouveautés : UNE requête Meili plafonnée, servie en props par le SSR
          (décision 06/09 — reprise partielle de l'interdit d'appel API du 03/09,
          qui visait le scan 700k de l'index auteurs, pas les requêtes Meili). */}
      {newBooks.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2">
            <h2 className="text-lg font-black text-[#1a0a40]">Nouveautés du catalogue</h2>
            <Link
              href="/books?sort=recent"
              className="text-xs font-bold text-[#6D28D9] hover:text-[#4c1d95] transition-colors"
            >
              Voir plus →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {newBooks.map((book) => (
              <BookCatalogCard key={book.id} book={book} view="grid" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}