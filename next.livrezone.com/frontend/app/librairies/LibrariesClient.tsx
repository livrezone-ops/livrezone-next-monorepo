"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Search, Store, ChevronLeft, ChevronRight, Sparkles,
  X, MapPin, Filter, ArrowDownWideNarrow,
} from "lucide-react";
import LibraryCard from "@/components/LibraryCard";
import type { LibraryItem } from "@/lib/libraries-api";
import type { CityRef } from "@/lib/listings-api";

interface LibrariesClientProps {
  initialLibraries: LibraryItem[];
  initialTotal: number;
  initialPage: number;
  initialLastPage: number;
  initialSearch: string;
  initialCity: number | null;
  initialCondition: string | null;
  initialSort: string;
  cities: CityRef[];
}

function buildQuery(params: {
  search?: string;
  city?: number | null;
  condition?: string | null;
  sort?: string;
  page?: number;
}): string {
  const q = new URLSearchParams();
  if (params.search) q.set("search", params.search);
  if (params.city) q.set("city", String(params.city));
  if (params.condition) q.set("condition", params.condition);
  if (params.sort && params.sort !== "rating") q.set("sort", params.sort);
  if (params.page && params.page > 1) q.set("page", String(params.page));
  return q.toString();
}

export default function LibrariesClient({
  initialLibraries,
  initialTotal,
  initialPage,
  initialLastPage,
  initialSearch,
  initialCity,
  initialCondition,
  initialSort,
  cities,
}: LibrariesClientProps) {
  const [libraries, setLibraries] = useState<LibraryItem[]>(initialLibraries);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [lastPage, setLastPage] = useState(initialLastPage);

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [city, setCity] = useState<number | null>(initialCity);
  const [condition, setCondition] = useState<string | null>(initialCondition);
  const [sort, setSort] = useState<string>(initialSort);
  const [loading, setLoading] = useState(false);

  const API_BASE = (
    process.env.NEXT_PUBLIC_API_URL || "https://api-next.livrezone.com"
  ).replace(/\/api\/?$/, "");

  const loadLibraries = useCallback(async (qs: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/libraries?${qs}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return;
      const json = await res.json();
      setLibraries(Array.isArray(json.data) ? json.data : []);
      setTotal(Number(json.total || 0));
      setLastPage(Number(json.last_page || 1));
      setPage(Number(json.current_page || 1));
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  useEffect(() => {
    setLibraries(initialLibraries);
    setTotal(initialTotal);
    setPage(initialPage);
    setLastPage(initialLastPage);
    setSearchTerm(initialSearch);
    setCity(initialCity);
    setCondition(initialCondition);
    setSort(initialSort);
  }, [initialLibraries, initialTotal, initialPage, initialLastPage, initialSearch, initialCity, initialCondition, initialSort]);

  const hasActiveFilters = Boolean(searchTerm || city || condition);

  const pushFilters = (next: {
    search?: string;
    city?: number | null;
    condition?: string | null;
    sort?: string;
    page?: number;
  }) => {
    const qs = buildQuery({
      search: next.search !== undefined ? next.search : searchTerm,
      city: next.city !== undefined ? next.city : city,
      condition: next.condition !== undefined ? next.condition : condition,
      sort: next.sort !== undefined ? next.sort : sort,
      page: next.page !== undefined ? next.page : 1,
    });
    window.history.replaceState(null, "", qs ? `/librairies?${qs}` : "/librairies");
    loadLibraries(qs);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    pushFilters({ search: searchTerm.trim() || undefined, page: 1 });
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    pushFilters({ search: undefined, page: 1 });
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value ? parseInt(e.target.value, 10) : null;
    setCity(value);
    pushFilters({ city: value, page: 1 });
  };

  const handleConditionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || null;
    setCondition(value);
    pushFilters({ condition: value, page: 1 });
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSort(value);
    pushFilters({ sort: value, page: 1 });
  };

  const handleReset = () => {
    setSearchTerm("");
    setCity(null);
    setCondition(null);
    setSort("rating");
    window.history.replaceState(null, "", "/librairies");
    loadLibraries("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > lastPage) return;
    const qs = buildQuery({ search: searchTerm || undefined, city, condition, sort, page: newPage });
    window.history.replaceState(null, "", qs ? `/librairies?${qs}` : "/librairies");
    loadLibraries(qs);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="w-[90%] max-w-7xl mx-auto py-8">
      {/* Bannière */}
      <div className="bg-gradient-to-r from-[#1a0a40] via-[#2a1154] to-[#6D28D9] text-white rounded-2xl p-6 sm:p-8 shadow-md relative overflow-hidden mb-8">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-violet-200 text-xs font-bold mb-3 border border-white/15 backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5 text-violet-300" />
            <span>Annuaire des librairies</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2.5">
            Les librairies en ligne
          </h1>

          <p className="text-sm sm:text-base text-violet-100/90 leading-relaxed font-normal">
            Découvrez les librairies et vendeurs de livres au Maroc. Filtrez par ville et par
            condition des livres, et triez par note ou par nombre de publications.
          </p>
        </div>

        <div className="absolute right-[-20px] bottom-[-30px] opacity-10 pointer-events-none hidden md:block">
          <Store className="w-64 h-64 text-white" />
        </div>
      </div>

      {/* Recherche par nom */}
      <div className="mb-5 relative">
        <form onSubmit={handleSearchSubmit} className="flex bg-white border border-gray-300 rounded-xl overflow-hidden shadow-xs focus-within:border-[#6D28D9] transition-all">
          <div className="relative flex-1 flex items-center">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher une librairie par nom..."
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
      </div>

      {/* Barre de filtres */}
      <div className="flex flex-col md:flex-row md:items-end gap-3 mb-6 pb-4 border-b border-gray-150">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Ville */}
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> Ville
            </span>
            <select
              value={city ?? ""}
              onChange={handleCityChange}
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-xs sm:text-sm text-gray-900 focus:outline-none focus:border-[#6D28D9] cursor-pointer"
            >
              <option value="">Toutes les villes</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          {/* Condition */}
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Condition
            </span>
            <select
              value={condition ?? ""}
              onChange={handleConditionChange}
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-xs sm:text-sm text-gray-900 focus:outline-none focus:border-[#6D28D9] cursor-pointer"
            >
              <option value="">Toutes les conditions</option>
              <option value="neuf">Neuf</option>
              <option value="occas">Occasion</option>
            </select>
          </label>

          {/* Tri */}
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <ArrowDownWideNarrow className="w-3.5 h-3.5" /> Trier par
            </span>
            <select
              value={sort}
              onChange={handleSortChange}
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-xs sm:text-sm text-gray-900 focus:outline-none focus:border-[#6D28D9] cursor-pointer"
            >
              <option value="rating">Mieux notés</option>
              <option value="publications">Plus de publications</option>
            </select>
          </label>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleReset}
            className="h-10 px-4 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Compteur */}
      <div className="text-xs sm:text-sm font-bold text-gray-700 mb-4">
        {total > 0 ? (
          <span>
            <span className="text-[#6D28D9]">{libraries.length}</span> librairie{total > 1 ? "s" : ""} affichées sur {total}
          </span>
        ) : (
          <span>0 librairie trouvée</span>
        )}
      </div>

      {/* Grille : 3 par ligne en desktop */}
      {libraries.length > 0 ? (
        <>
            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 ${loading ? "opacity-60 pointer-events-none" : ""}`}>
            {libraries.map((lib) => (
              <LibraryCard key={lib.id} library={lib} />
            ))}
          </div>

          {lastPage > 1 && (
            <div className="flex items-center justify-center gap-2 mt-12">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="p-2.5 border border-gray-200 bg-white rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-4 py-2.5 bg-[#1a0a40] text-white text-xs font-bold rounded-xl shadow-xs">
                Page {page} sur {lastPage}
              </span>

              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= lastPage}
                className="p-2.5 border border-gray-200 bg-white rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white border border-gray-150 rounded-2xl p-12 text-center shadow-xs">
          <div className="w-16 h-16 bg-violet-50 text-[#6D28D9] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Store className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-gray-900 mb-2">Aucune librairie trouvée</h3>
          <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto mb-6">
            Aucune librairie ne correspond à vos critères de recherche. Essayez d'élargir vos filtres.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleReset}
              className="px-5 py-2.5 bg-[#6D28D9] text-white rounded-xl font-bold text-xs hover:bg-violet-800 transition-all shadow-xs cursor-pointer"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      )}
    </div>
  );
}
