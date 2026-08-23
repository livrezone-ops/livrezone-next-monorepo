"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  Search, BookOpen, ChevronLeft, ChevronRight, 
  Sparkles, X, LayoutGrid, List as ListIcon, 
  Loader2, Plus, ArrowRight
} from "lucide-react";
import api from "@/lib/axios";
import Breadcrumbs from "@/components/Breadcrumbs";
import FilterSidebar from "@/components/FilterSidebar";
import BookCatalogCard from "@/components/BookCatalogCard";
import type { BookSearchItem } from "@/lib/books-api";
import type { CityRef } from "@/lib/listings-api";
import { parseFilters, buildFilterQuery } from "@/lib/listings-filters";
import { useToast } from "@/components/Toast";
import type { BookSection } from "./page";

interface BooksClientProps {
  initialBooks: BookSearchItem[];
  initialTotal: number;
  initialPage: number;
  initialLastPage: number;
  initialSearch: string;
  cities: CityRef[];
  sections?: BookSection[];
  isDefaultView?: boolean;
}

export default function BooksClient({
  initialBooks,
  initialTotal,
  initialPage,
  initialLastPage,
  initialSearch,
  cities,
  sections = [],
  isDefaultView = false,
}: BooksClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success, error: toastError } = useToast();

  const [books, setBooks] = useState<BookSearchItem[]>(initialBooks);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [lastPage, setLastPage] = useState(initialLastPage);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [view, setView] = useState<"grid" | "list">("list");

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const filters = parseFilters((key) => searchParams.get(key));

  useEffect(() => {
    setBooks(initialBooks);
    setTotal(initialTotal);
    setPage(initialPage);
    setLastPage(initialLastPage);
    setSearchTerm(initialSearch);
  }, [initialBooks, initialTotal, initialPage, initialLastPage, initialSearch]);

  // Click outside autocomplete dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch instant autocomplete suggestions
  useEffect(() => {
    const term = searchTerm.trim();
    if (!term || term.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get(`/books/autocomplete?q=${encodeURIComponent(term)}&limit=6`);
        setSuggestions(Array.isArray(data) ? data : []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    const params = buildFilterQuery({
      categories: filters.categories,
      languages: filters.languages,
      levels: filters.levels,
      search: searchTerm.trim() || undefined,
      page: 1,
    });
    const qs = params.toString();
    router.push(qs ? `/books?${qs}` : "/books");
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setShowSuggestions(false);
    const params = buildFilterQuery({
      categories: filters.categories,
      languages: filters.languages,
      levels: filters.levels,
      page: 1,
    });
    const qs = params.toString();
    router.push(qs ? `/books?${qs}` : "/books");
  };

  const handleSuggestionClick = (item: any) => {
    setShowSuggestions(false);
    if (item.id) {
      router.push(`/books/${item.id}`);
    } else {
      setSearchTerm(item.title || item.isbn_13 || "");
      const params = buildFilterQuery({
        categories: filters.categories,
        languages: filters.languages,
        levels: filters.levels,
        search: item.title || item.isbn_13 || undefined,
        page: 1,
      });
      const qs = params.toString();
      router.push(qs ? `/books?${qs}` : "/books");
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > lastPage) return;
    const params = buildFilterQuery({
      categories: filters.categories,
      languages: filters.languages,
      levels: filters.levels,
      search: filters.search,
      page: newPage,
    });
    const qs = params.toString();
    router.push(qs ? `/books?${qs}` : "/books");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleRequestBook = async (book?: BookSearchItem) => {
    if (!book) {
      router.push("/dashboard/demandes/create");
      return;
    }

    try {
      await api.post("/orders", { book_id: book.id });
      success("Votre demande a bien été enregistrée ! Les vendeurs Pro/Premium seront alertés.");
    } catch (err: any) {
      toastError(err.response?.data?.message || "Erreur lors de la création de la demande.");
    }
  };

  const hasActiveFilters = Boolean(
    filters.search ||
    filters.categories.length > 0 ||
    filters.languages.length > 0 ||
    filters.levels.length > 0
  );

  return (
    <div className="w-[90%] max-w-7xl mx-auto py-8">
      {/* Fil d'Ariane */}
      <Breadcrumbs
        items={[
          { label: "Catalogue des livres" },
        ]}
      />

      {/* BANNIÈRE VISIBLE & EXPLICATIVE */}
      <div className="bg-gradient-to-r from-[#1a0a40] via-[#2a1154] to-[#6D28D9] text-white rounded-2xl p-6 sm:p-8 shadow-md relative overflow-hidden mb-8">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-violet-200 text-xs font-bold mb-3 border border-white/15 backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5 text-violet-300" />
            <span>Référentiel & Catalogue Officiel</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2.5">
            Catalogue des livres
          </h1>

          <p className="text-sm sm:text-base text-violet-100/90 leading-relaxed mb-6 font-normal">
            Explorez le catalogue par titre ou par auteur et déposez une demande pour les livres que vous cherchez. 
            Vous recevrez une alerte dès qu'un vendeur les proposera sur la plateforme.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleRequestBook()}
              className="px-5 py-2.5 bg-white text-[#1a0a40] hover:bg-violet-50 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#6D28D9]" />
              <span>Demander un livre</span>
            </button>

            <Link
              href="/demandes"
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm rounded-xl transition-all border border-white/20 flex items-center gap-1.5 cursor-pointer"
            >
              <span>Voir les demandes en cours</span>
              <ArrowRight className="w-3.5 h-3.5 text-violet-300" />
            </Link>
          </div>
        </div>

        {/* Décoration d'arrière-plan */}
        <div className="absolute right-[-20px] bottom-[-30px] opacity-10 pointer-events-none hidden md:block">
          <BookOpen className="w-64 h-64 text-white" />
        </div>
      </div>

      {/* RECHERCHE AVEC AUTOCOMPLÉTION & VIGNETTES */}
      <div className="mb-8 relative" ref={searchContainerRef}>
        <form onSubmit={handleSearchSubmit} className="flex bg-white border border-gray-300 rounded-xl overflow-hidden shadow-xs focus-within:border-[#6D28D9] transition-all">
          <div className="relative flex-1 flex items-center">
            {isSearching ? (
              <Loader2 className="w-4 h-4 text-[#6D28D9] absolute left-3.5 animate-spin" />
            ) : (
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5" />
            )}
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              placeholder="Rechercher par titre, auteur ou code ISBN..."
              className="w-full pl-10 pr-4 py-3 text-xs sm:text-sm text-gray-900 focus:outline-none"
              autoComplete="off"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="p-2 text-gray-400 hover:text-gray-600 cursor-pointer"
                title="Effacer la recherche"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="submit"
            className="bg-[#1a0a40] hover:bg-[#6D28D9] text-white font-bold px-6 text-xs sm:text-sm transition-colors cursor-pointer"
          >
            Rechercher
          </button>
        </form>

        {/* Menu déroulant des suggestions d'autocomplétion */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto animate-in slide-in-from-top-2 duration-150">
            <div className="p-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider px-3 border-b border-gray-100">
              Suggestions de livres
            </div>
            <ul className="py-1">
              {suggestions.map((item) => {
                const cover = item.cover_thumbnail_url || item.cover_url || null;
                const author = item.authors
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
                        <img
                          src={cover}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <BookOpen className="w-4 h-4 text-gray-400" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-900 truncate group-hover:text-[#6D28D9] transition-colors">
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        {author && <span className="truncate max-w-[200px]">De : {author}</span>}
                        {item.isbn_13 && (
                          <span className="text-[10px] font-mono text-gray-400 hidden sm:inline">
                            · ISBN: {item.isbn_13}
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

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-start">
        {/* Sidebar des filtres */}
        <FilterSidebar
          cities={cities}
          sections={["categories", "languages", "levels"]}
          basePath="/books"
        />

        {/* Contenu principal */}
        <main className="flex-1 min-w-0 w-full">
          
          {isDefaultView ? (
            /* VUE PAR DÉFAUT : GRILLES HORIZONTALES PAR CATÉGORIE */
            <div className="space-y-10">
              {sections.map((section) => (
                <section key={section.code} className="relative">
                  <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2">
                    <h2 className="text-lg font-black text-[#1a0a40] flex items-center gap-2">
                      <div className="w-1.5 h-5 bg-[#F97316] rounded-full"></div>
                      {section.name}
                    </h2>
                    <Link
                      href={`/books?categories=${section.code}`}
                      className="text-xs font-bold text-[#6D28D9] hover:text-[#4c1d95] flex items-center gap-1 transition-colors"
                    >
                      Voir plus <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                  
                  {/* Grille horizontale avec scroll snap */}
                  <div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory scroll-smooth hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                    {section.books.map((book) => (
                      <div key={book.id} className="w-[300px] shrink-0 snap-start">
                        <BookCatalogCard
                          book={book}
                          view="grid"
                          onRequestBook={handleRequestBook}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            /* VUE RECHERCHE / FILTRES : PAGINATION CLASSIQUE */
            <>
              {/* Sub-toolbar: Compteur + Bascule Vue Grille / Vue Ligne */}
              <div className="flex items-center justify-between gap-4 mb-5 pb-3 border-b border-gray-150">
                <div className="text-xs sm:text-sm font-bold text-gray-700">
                  {total > 0 ? (
                    <span>
                      Affichage de <span className="text-[#6D28D9]">{books.length}</span> sur {total} livre{total > 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span>0 livre trouvé</span>
                  )}
                </div>

                {/* Boutons Vue Grille / Vue Ligne */}
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setView("list")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      view === "list"
                        ? "bg-white text-[#6D28D9] shadow-xs"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                    title="Vue en ligne (liste compacte)"
                  >
                    <ListIcon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Ligne</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setView("grid")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      view === "grid"
                        ? "bg-white text-[#6D28D9] shadow-xs"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                    title="Vue en grille (3 colonnes)"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Grille</span>
                  </button>
                </div>
              </div>

              {books.length > 0 ? (
                <>
                  {/* Grille ou Liste de Livres */}
                  {view === "list" ? (
                    <div className="flex flex-col gap-3">
                      {books.map((book) => (
                        <BookCatalogCard
                          key={book.id}
                          book={book}
                          view="list"
                          onRequestBook={handleRequestBook}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4.5">
                      {books.map((book) => (
                        <BookCatalogCard
                          key={book.id}
                          book={book}
                          view="grid"
                          onRequestBook={handleRequestBook}
                        />
                      ))}
                    </div>
                  )}

                  {/* Pagination */}
                  {lastPage > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-12">
                      <button
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page <= 1}
                        className="p-2.5 border border-gray-250 bg-white rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      <span className="px-4 py-2.5 bg-[#1a0a40] text-white text-xs font-bold rounded-xl shadow-xs">
                        Page {page} sur {lastPage}
                      </span>

                      <button
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page >= lastPage}
                        className="p-2.5 border border-gray-250 bg-white rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-white border border-gray-150 rounded-2xl p-12 text-center shadow-xs">
                  <div className="w-16 h-16 bg-violet-50 text-[#6D28D9] rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-black text-gray-900 mb-2">Aucun livre trouvé</h3>
                  <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto mb-6">
                    Aucun livre dans le catalogue ne correspond à vos critères de recherche.
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    {hasActiveFilters && (
                      <Link
                        href="/books"
                        className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-200 transition-colors"
                      >
                        Réinitialiser les filtres
                      </Link>
                    )}
                    <button
                      type="button"
              onClick={() => handleRequestBook()}
                      className="px-5 py-2.5 bg-[#6D28D9] text-white rounded-xl font-bold text-xs hover:bg-violet-800 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Déposer une demande de livre
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Cacher les scrollbars mais garder le scroll */}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}
