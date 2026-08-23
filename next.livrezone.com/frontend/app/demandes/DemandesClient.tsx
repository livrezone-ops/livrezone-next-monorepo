"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  Search, Plus, Sparkles, ChevronLeft, ChevronRight, 
  X, BookOpen, LayoutGrid, List as ListIcon 
} from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";
import DemandCard, { DemandItem } from "@/components/DemandCard";
import FilterSidebar from "@/components/FilterSidebar";
import type { CityRef } from "@/lib/listings-api";
import { parseFilters, buildFilterQuery } from "@/lib/listings-filters";

interface DemandesClientProps {
  initialDemandes: DemandItem[];
  initialTotal: number;
  initialPage: number;
  initialLastPage: number;
  initialSearch: string;
  cities: CityRef[];
}

export default function DemandesClient({
  initialDemandes,
  initialTotal,
  initialPage,
  initialLastPage,
  initialSearch,
  cities,
}: DemandesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [demandes, setDemandes] = useState<DemandItem[]>(initialDemandes);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [lastPage, setLastPage] = useState(initialLastPage);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [view, setView] = useState<"grid" | "list">("list");

  const filters = parseFilters((key) => searchParams.get(key));

  useEffect(() => {
    setDemandes(initialDemandes);
    setTotal(initialTotal);
    setPage(initialPage);
    setLastPage(initialLastPage);
    setSearchTerm(initialSearch);
  }, [initialDemandes, initialTotal, initialPage, initialLastPage, initialSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = buildFilterQuery({
      categories: filters.categories,
      languages: filters.languages,
      cities: filters.cities,
      search: searchTerm.trim() || undefined,
      page: 1,
    });
    const qs = params.toString();
    router.push(qs ? `/demandes?${qs}` : "/demandes");
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    const params = buildFilterQuery({
      categories: filters.categories,
      languages: filters.languages,
      cities: filters.cities,
      page: 1,
    });
    const qs = params.toString();
    router.push(qs ? `/demandes?${qs}` : "/demandes");
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > lastPage) return;
    const params = buildFilterQuery({
      categories: filters.categories,
      languages: filters.languages,
      cities: filters.cities,
      search: filters.search,
      page: newPage,
    });
    const qs = params.toString();
    router.push(qs ? `/demandes?${qs}` : "/demandes");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const hasActiveFilters = Boolean(
    filters.search ||
    filters.categories.length > 0 ||
    filters.cities.length > 0 ||
    filters.languages.length > 0
  );

  return (
    <div className="w-[90%] max-w-7xl mx-auto py-8">
      {/* Fil d'Ariane */}
      <Breadcrumbs
        items={[
          { label: "Demandes de livres" },
        ]}
      />

      {/* Header Banner */}
      <div className="mb-8 pb-6 border-b border-gray-150 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900 mb-1 flex items-center gap-2.5">
            <Sparkles className="w-7 h-7 text-[#6D28D9]" />
            {filters.search ? `Recherche : « ${filters.search} »` : "Livres recherchés par la communauté"}
          </h1>
          <div className="flex items-center gap-2.5 flex-wrap mt-1">
            <span className="text-xs sm:text-sm text-gray-500 font-medium">
              {total} {total > 1 ? "demandes de livres en attente d'offres" : "demande de livre en attente d'offres"}
            </span>
            {hasActiveFilters && (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 border border-slate-200/80 px-2.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6D28D9]" />
                <span className="text-slate-500 italic">(filtré)</span>
                <span className="text-slate-300">·</span>
                <Link
                  href="/demandes"
                  className="text-[#6D28D9] hover:text-violet-900 font-bold hover:underline inline-flex items-center gap-1 transition-colors"
                  title="Effacer tous les filtres"
                >
                  <span>Effacer les filtres</span>
                  <X className="w-3 h-3" />
                </Link>
              </span>
            )}
          </div>
        </div>

        <Link
          href="/books"
          className="px-5 py-3 bg-[#6D28D9] text-white hover:bg-violet-800 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 self-start md:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Demander un livre
        </Link>
      </div>

      {/* Search Bar */}
      <div className="mb-8">
        <form onSubmit={handleSearchSubmit} className="flex bg-white border border-gray-300 rounded-xl overflow-hidden shadow-xs focus-within:border-[#6D28D9] transition-all">
          <div className="relative flex-1 flex items-center">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par titre, auteur ou ISBN..."
              className="w-full pl-10 pr-4 py-3 text-xs sm:text-sm text-gray-900 focus:outline-none"
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

      {/* Main Layout: FilterSidebar (Universel) + Content */}
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-start">
        {/* Sidebar des filtres */}
        <FilterSidebar
          cities={cities}
          sections={["categories", "languages", "cities"]}
          basePath="/demandes"
        />

        {/* Contenu principal */}
        <main className="flex-1 min-w-0 w-full">
          {/* Sub-toolbar: Compteur + Bascule Vue Grille / Vue Ligne */}
          <div className="flex items-center justify-between gap-4 mb-5 pb-3 border-b border-gray-150">
            <div className="text-xs sm:text-sm font-bold text-gray-700">
              {total > 0 ? (
                <span>
                  Affichage de <span className="text-[#6D28D9]">{demandes.length}</span> sur {total} demande{total > 1 ? "s" : ""}
                </span>
              ) : (
                <span>0 résultat</span>
              )}
            </div>

            {/* Boutons Vue Grille / Vue Ligne */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
              <button
                type="button"
                onClick={() => setView("grid")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  view === "grid"
                    ? "bg-white text-[#6D28D9] shadow-xs"
                    : "text-gray-500 hover:text-gray-900"
                }`}
                title="Vue en grille"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Grille</span>
              </button>

              <button
                type="button"
                onClick={() => setView("list")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  view === "list"
                    ? "bg-white text-[#6D28D9] shadow-xs"
                    : "text-gray-500 hover:text-gray-900"
                }`}
                title="Vue en ligne (liste)"
              >
                <ListIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ligne</span>
              </button>
            </div>
          </div>

          {demandes.length > 0 ? (
            <>
              {/* Grille ou Liste de DemandCard */}
              {view === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4.5">
                  {demandes.map((demand) => (
                    <DemandCard key={demand.id} demand={demand} view="grid" />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {demandes.map((demand) => (
                    <DemandCard key={demand.id} demand={demand} view="list" />
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
              <h3 className="text-lg font-black text-gray-900 mb-2">Aucune demande trouvée</h3>
              <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto mb-6">
                Aucune demande de livre ne correspond à vos critères de recherche actuels.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {hasActiveFilters && (
                  <Link
                    href="/demandes"
                    className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-200 transition-colors"
                  >
                    Réinitialiser les filtres
                  </Link>
                )}
                <Link
                  href="/books"
                  className="px-5 py-2.5 bg-[#6D28D9] text-white rounded-xl font-bold text-xs hover:bg-violet-800 transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Demander un livre
                </Link>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
