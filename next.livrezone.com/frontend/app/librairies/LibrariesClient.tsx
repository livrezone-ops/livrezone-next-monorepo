"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Search, Store, ChevronLeft, ChevronRight, Sparkles, X, ArrowDownWideNarrow } from "lucide-react";
import FilterSidebar from "@/components/FilterSidebar";
import LibraryCard from "@/components/LibraryCard";
import type { LibraryItem } from "@/lib/libraries-api";
import type { CityRef } from "@/lib/listings-api";

interface LibrariesClientProps {
  initialLibraries: LibraryItem[];
  initialTotal: number;
  initialPage: number;
  initialLastPage: number;
  initialSearch: string;
  initialCities: number[];
  initialConditions: string[];
  initialSort: string;
  cities: CityRef[];
  initialFacets?: {
    cities?: Record<string, number>;
    conditions?: Record<string, number>;
  };
}

export default function LibrariesClient({
  initialLibraries,
  initialTotal,
  initialPage,
  initialLastPage,
  initialSearch,
  initialCities,
  initialConditions,
  initialSort,
  cities,
  initialFacets,
}: LibrariesClientProps) {
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams(searchParams.toString());
    if (searchTerm) q.set("search", searchTerm);
    else q.delete("search");
    q.delete("page");
    router.push(`${pathname}?${q.toString()}`);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    const q = new URLSearchParams(searchParams.toString());
    q.delete("search");
    q.delete("page");
    router.push(`${pathname}?${q.toString()}`);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSort = e.target.value;
    const q = new URLSearchParams(searchParams.toString());
    if (newSort === "rating") q.set("sort", "rating");
    else q.delete("sort");
    q.delete("page");
    router.push(`${pathname}?${q.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const q = new URLSearchParams(searchParams.toString());
    if (newPage > 1) q.set("page", String(newPage));
    else q.delete("page");
    router.push(`${pathname}?${q.toString()}`);
  };

  return (
    <div className="w-[90%] max-w-7xl mx-auto py-8">
      {/* Bannière */}
      <div className="bg-[#1a0a40] rounded-2xl p-6 sm:p-10 mb-8 sm:mb-10 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between">
        <div className="relative z-10 w-full">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-[11px] font-bold tracking-wide uppercase mb-4">
            <Sparkles className="w-3.5 h-3.5 text-violet-300" />
            Réseau de professionnels
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black mb-3">
            Annuaire des Librairies
          </h1>
          <p className="text-sm sm:text-base text-violet-200 max-w-2xl">
            Trouvez les meilleures librairies et vendeurs professionnels au Maroc.
            Découvrez leurs catalogues, leurs spécialités et leurs avis.
          </p>
        </div>

        <div className="absolute right-[-20px] bottom-[-30px] opacity-10 pointer-events-none hidden md:block">
          <Store className="w-64 h-64 text-white" />
        </div>
      </div>

      {/* Layout principal (Sidebar + Contenu) */}
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-start">
        {/* Sidebar filtres réutilisée ! */}
        <React.Suspense fallback={<div className="w-full lg:w-[240px] animate-pulse h-96 bg-gray-100 rounded-xl" />}>
          <FilterSidebar
            sections={["cities", "conditions"]}
            basePath="/librairies"
            cities={cities}
            facets={initialFacets}
          />
        </React.Suspense>

        {/* Contenu principal */}
        <main className="flex-1 min-w-0 w-full">
          {/* Recherche et tri */}
          <div className="mb-5 flex flex-col sm:flex-row gap-4 items-center">
            <form onSubmit={handleSearchSubmit} className="flex-1 w-full flex bg-white border border-gray-300 rounded-xl overflow-hidden shadow-xs focus-within:border-[#6D28D9] transition-all">
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
                className="bg-[#1a0a40] hover:bg-[#6D28D9] text-white font-bold px-5 text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Rechercher
              </button>
            </form>

            <div className="w-full sm:w-auto">
              <label className="relative flex items-center">
                <span className="absolute left-3 text-gray-500">
                  <ArrowDownWideNarrow className="w-4 h-4" />
                </span>
                <select
                  value={initialSort}
                  onChange={handleSortChange}
                  className="w-full sm:w-auto h-[46px] rounded-xl border border-gray-300 bg-white pl-9 pr-8 text-xs sm:text-sm text-gray-900 focus:outline-none focus:border-[#6D28D9] cursor-pointer appearance-none shadow-xs"
                >
                  <option value="publications">Plus d'annonces</option>
                  <option value="rating">Mieux notées</option>
                </select>
              </label>
            </div>
          </div>

          {/* Compteur */}
          <div className="text-xs sm:text-sm font-bold text-gray-700 mb-4">
            {initialTotal > 0 ? (
              <span>
                <span className="text-[#6D28D9]">{initialLibraries.length}</span> librairie{initialTotal > 1 ? "s" : ""} affichées sur {initialTotal}
              </span>
            ) : (
              <span>0 librairie trouvée</span>
            )}
          </div>

          {/* Grille : 3 par ligne en desktop */}
          {initialLibraries.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {initialLibraries.map((lib) => (
                  <LibraryCard key={lib.id} library={lib} />
                ))}
              </div>

              {initialLastPage > 1 && (
                <div className="flex items-center justify-center gap-2 mt-12">
                  <button
                    onClick={() => handlePageChange(initialPage - 1)}
                    disabled={initialPage <= 1}
                    className="p-2.5 border border-gray-200 bg-white rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-4 py-2.5 bg-[#1a0a40] text-white text-xs font-bold rounded-xl shadow-xs">
                    Page {initialPage} sur {initialLastPage}
                  </span>

                  <button
                    onClick={() => handlePageChange(initialPage + 1)}
                    disabled={initialPage >= initialLastPage}
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
              <button
                type="button"
                onClick={() => router.push("/librairies")}
                className="px-5 py-2.5 bg-[#6D28D9] text-white rounded-xl font-bold text-xs hover:bg-violet-800 transition-all shadow-xs cursor-pointer"
              >
                Réinitialiser les filtres
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}