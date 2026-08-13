"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { 
  Search, SlidersHorizontal, BookOpen, GraduationCap, 
  MapPin, ShieldAlert, ChevronLeft, ChevronRight, X
} from "lucide-react";
import BookCard from "./BookCard";

interface Listing {
  id: number;
  user_id: number;
  title: string;
  price: number;
  discount_price?: number | null;
  book_condition: string;
  isbn_13?: string | null;
  cover_path?: string | null;
  cover_source_url?: string | null;
  book?: {
    isbn_13?: string | null;
    authors?: string[] | string | null;
    cover_url?: string | null;
  } | null;
  user?: {
    profile?: {
      nickname?: string | null;
      city?: {
        name?: string | null;
      } | null;
    } | null;
  } | null;
}

export default function ListingsSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Search parameters states
  const searchQ = searchParams.get("search") || "";
  const catQ = searchParams.get("category") || "";
  const lvlQ = searchParams.get("level") || "";
  const condQ = searchParams.get("condition") || "";
  const sortQ = searchParams.get("sort") || "latest";
  const pageQ = parseInt(searchParams.get("page") || "1");

  // Local state
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Filter options lists
  const categories = [
    { code: "", name: "Toutes les catégories" },
    { code: "litterature", name: "Littérature" },
    { code: "scolaire", name: "Scolaire" },
    { code: "universitaire", name: "Universitaire" },
    { code: "jeunesse", name: "Jeunesse" },
    { code: "religion", name: "Religion" },
    { code: "vie-pratique", name: "Vie Pratique" },
  ];

  const levels = [
    { code: "", name: "Tous les niveaux" },
    { code: "1bac", name: "1re année BAC" },
    { code: "2bac", name: "2e année BAC" },
    { code: "tcommun", name: "Tronc Commun" },
    { code: "college", name: "Collège" },
    { code: "primaire", name: "Primaire" }
  ];

  const conditions = [
    { code: "", name: "Tous les états" },
    { code: "neuf", name: "Neuf" },
    { code: "occas", name: "Occasion" }
  ];

  // Fetch listings
  useEffect(() => {
    let active = true;
    const fetchListings = async () => {
      setLoading(true);
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "https://api-next.livrezone.com";
        const query = new URLSearchParams({
          search: searchQ,
          category: catQ,
          level: lvlQ,
          condition: condQ,
          sort: sortQ,
          page: pageQ.toString(),
          limit: "12"
        });

        const res = await fetch(`${baseUrl}/api/listings?${query.toString()}`, {
          cache: "no-store"
        });

        if (!res.ok) throw new Error("API error");
        
        const json = await res.json();
        
        if (active) {
          setListings(json.data || []);
          setLastPage(json.last_page || 1);
          setTotal(json.total || 0);
        }
      } catch (e) {
        if (active) {
          // Mock fallbacks for demonstration
          setListings([
            {
              id: 1,
              user_id: 10,
              title: "La Boîte à merveilles",
              price: 35.00,
              discount_price: 25.00,
              book_condition: "occas",
              book: { authors: "Ahmed Sefrioui", cover_url: null },
              user: { profile: { nickname: "ouahib", city: { name: "Casablanca" } } }
            },
            {
              id: 2,
              user_id: 10,
              title: "Le Dernier Jour d'un condamné",
              price: 30.00,
              book_condition: "neuf",
              book: { authors: "Victor Hugo", cover_url: null },
              user: { profile: { nickname: "ouahib", city: { name: "Rabat" } } }
            }
          ]);
          setTotal(2);
          setLastPage(1);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchListings();
    return () => { active = false; };
  }, [searchQ, catQ, lvlQ, condQ, sortQ, pageQ]);

  // Helper to push new URL params
  const updateParams = (newParams: Record<string, string | number | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([key, val]) => {
      if (val === null || val === "") {
        params.delete(key);
      } else {
        params.set(key, val.toString());
      }
    });
    // Reset page to 1 on filter changes unless page parameter was explicitly set
    if (!newParams.page) {
      params.delete("page");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const searchVal = fd.get("search") as string;
    updateParams({ search: searchVal });
  };

  const slugify = (text: string) => {
    return text
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^\w\-]+/g, "")
      .replace(/\-\-+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "");
  };

  // Render Sidebar
  const Sidebar = () => (
    <div className="flex flex-col gap-6 font-sans">
      {/* Categories */}
      <div className="bg-white border border-gray-150 rounded-xl p-5 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3.5">Catégories</h3>
        <div className="flex flex-col gap-2">
          {categories.map((c) => (
            <button
              key={c.code}
              onClick={() => updateParams({ category: c.code })}
              className={`text-left text-xs py-1 px-2 rounded font-bold transition-all cursor-pointer ${
                catQ === c.code 
                  ? "bg-violet-50 text-[#6D28D9]" 
                  : "text-gray-600 hover:bg-gray-50 hover:text-black"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Levels */}
      <div className="bg-white border border-gray-150 rounded-xl p-5 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3.5">Niveau Scolaire</h3>
        <div className="flex flex-col gap-2">
          {levels.map((l) => (
            <button
              key={l.code}
              onClick={() => updateParams({ level: l.code })}
              className={`text-left text-xs py-1 px-2 rounded font-bold transition-all cursor-pointer ${
                lvlQ === l.code 
                  ? "bg-violet-50 text-[#6D28D9]" 
                  : "text-gray-600 hover:bg-gray-50 hover:text-black"
              }`}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>

      {/* Condition */}
      <div className="bg-white border border-gray-150 rounded-xl p-5 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3.5">État du livre</h3>
        <div className="flex flex-col gap-2">
          {conditions.map((cond) => (
            <button
              key={cond.code}
              onClick={() => updateParams({ condition: cond.code })}
              className={`text-left text-xs py-1 px-2 rounded font-bold transition-all cursor-pointer ${
                condQ === cond.code 
                  ? "bg-violet-50 text-[#6D28D9]" 
                  : "text-gray-600 hover:bg-gray-50 hover:text-black"
              }`}
            >
              {cond.name}
            </button>
          ))}
        </div>
      </div>

      {/* Clear Filters */}
      {(catQ || lvlQ || condQ || searchQ) && (
        <button
          onClick={() => router.push(pathname)}
          className="w-full text-center py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-xs transition-colors cursor-pointer"
        >
          Réinitialiser les filtres
        </button>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 font-sans">
      
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:block lg:col-span-3">
        <Sidebar />
      </aside>

      {/* Main Search Results Area */}
      <main className="lg:col-span-9 flex flex-col gap-6">
        
        {/* Search header & sorting */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white border border-gray-150 rounded-xl p-4 shadow-xs">
          
          {/* Search box input */}
          <form onSubmit={handleSearchSubmit} className="flex-1 flex border border-gray-200 rounded-lg overflow-hidden h-10 shadow-inner">
            <span className="flex items-center justify-center pl-3 text-gray-400">
              <Search className="h-4 w-4" />
            </span>
            <input 
              type="search" 
              name="search"
              defaultValue={searchQ}
              placeholder="Rechercher par titre, auteur ou ISBN..." 
              className="flex-1 px-3 text-xs bg-transparent focus:outline-none"
            />
            <button type="submit" className="bg-[#6D28D9] hover:bg-violet-800 text-white font-bold px-4 text-xs transition-colors cursor-pointer">
              Go
            </button>
          </form>

          <div className="flex items-center gap-3 justify-between sm:justify-start">
            {/* Mobile Filters trigger */}
            <button 
              onClick={() => setMobileFiltersOpen(true)}
              className="lg:hidden flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer shadow-xs"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtres
            </button>

            {/* Sort select */}
            <select
              value={sortQ}
              onChange={(e) => updateParams({ sort: e.target.value })}
              className="text-xs border border-gray-200 rounded-lg py-2 pl-2 pr-8 text-gray-600 focus:outline-none bg-white shadow-xs cursor-pointer"
            >
              <option value="latest">Plus récents</option>
              <option value="price_asc">Prix croissant</option>
              <option value="price_desc">Prix décroissant</option>
            </select>
          </div>

        </div>

        {/* Loading / Results grid */}
        {loading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6D28D9]"></div>
          </div>
        ) : listings.length > 0 ? (
          <div className="flex flex-col gap-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-6">
              {listings.map((l) => {
                const authors = l.book?.authors
                  ? (Array.isArray(l.book.authors) ? l.book.authors.join(", ") : l.book.authors)
                  : null;

                // Priorité : cover_url du proxy Laravel (fourni par l'API) → cover_source_url → null
                const coverUrl = l.book?.cover_url
                  || l.cover_source_url
                  || null;

                const nickname = l.user?.profile?.nickname || `utilisateur-${l.user_id}`;
                const isbn = l.isbn_13 || l.book?.isbn_13 || "livre";
                const titleSlug = slugify(l.title);
                const listingUrl = `/${nickname}/${l.id}-${isbn}-${titleSlug}`;

                return (
                  <BookCard
                    key={l.id}
                    title={l.title}
                    author={authors}
                    price={l.price}
                    discountPrice={l.discount_price}
                    cover={coverUrl}
                    condition={l.book_condition}
                    url={listingUrl}
                    city={l.user?.profile?.city?.name || null}
                  />
                );
              })}
            </div>

            {/* Pagination Controls */}
            {lastPage > 1 && (
              <div className="flex justify-center items-center gap-2 mt-4 font-bold text-xs">
                <button
                  disabled={pageQ <= 1}
                  onClick={() => updateParams({ page: pageQ - 1 })}
                  className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-gray-500">
                  Page <span className="text-black">{pageQ}</span> sur {lastPage}
                </span>
                <button
                  disabled={pageQ >= lastPage}
                  onClick={() => updateParams({ page: pageQ + 1 })}
                  className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white border border-gray-150 rounded-2xl p-16 text-center shadow-xs">
            <ShieldAlert className="h-16 w-16 text-gray-300 stroke-1 mx-auto mb-4" />
            <h3 className="text-lg font-black text-gray-950 mb-1">Aucune annonce trouvée</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
              Nous n'avons trouvé aucun livre correspondant à vos critères de filtres ou à votre terme de recherche.
            </p>
          </div>
        )}

      </main>

      {/* Mobile Drawer Slide-out */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div 
            onClick={() => setMobileFiltersOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
          ></div>
          <div className="relative w-72 bg-gray-50 flex flex-col z-10 animate-in slide-in-from-left duration-250 shadow-2xl p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <span className="text-lg font-black text-black">Filtres</span>
              <button 
                onClick={() => setMobileFiltersOpen(false)}
                className="text-gray-400 hover:text-black p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <Sidebar />
          </div>
        </div>
      )}

    </div>
  );
}
