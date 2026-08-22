"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Image from "next/image";
import {
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LayoutGrid,
  List as ListIcon,
} from "lucide-react";
import BookCard from "./BookCard";
import { buildListingPath, type ListingSummary } from "@/lib/listings-api";

interface ListingsSearchProps {
  initialListings?: ListingSummary[];
  initialTotal?: number;
  initialLastPage?: number;
  userId?: number;
}

export default function ListingsSearch({
  initialListings,
  initialTotal,
  initialLastPage,
  userId,
}: ListingsSearchProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const searchQ = searchParams.get("search") || "";
  const sortQ = searchParams.get("sort") || "latest";
  const pageQ = parseInt(searchParams.get("page") || "1", 10) || 1;

  const [view, setView] = useState<"grid" | "list">("grid");
  const [searchInput, setSearchInput] = useState(searchQ);
  const [listings, setListings] = useState<ListingSummary[]>(
    initialListings ? initialListings : []
  );
  const [loading, setLoading] = useState(initialListings === undefined);
  const [lastPage, setLastPage] = useState(initialLastPage ?? 1);
  const [, setTotal] = useState(initialTotal ?? 0);

  const hydratedRef = useRef(initialListings !== undefined);

  // Ref sur le haut de la liste des annonces pour un scroll propre (pagination/recherche).
  const listTopRef = useRef<HTMLDivElement>(null);

  // Dernière valeur de recherche effectivement poussée dans l'URL.
  // Permet de distinguer un changement d'URL externe (header) d'un retour
  // d'écho de notre propre debounce, pour ne jamais écraser la saisie en cours.
  const lastPushedSearch = useRef(searchQ);

  const updateParams = (newParams: Record<string, string | number | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([key, val]) => {
      if (val === null || val === "") {
        params.delete(key);
      } else {
        params.set(key, val.toString());
      }
    });
    if (!newParams.page) {
      params.delete("page");
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Synchronise le champ quand l'URL change en dehors de notre debounce
  // (ex : recherche soumise depuis le header).
  useEffect(() => {
    if (searchQ !== lastPushedSearch.current) {
      setSearchInput(searchQ);
      lastPushedSearch.current = searchQ;
    }
  }, [searchQ]);

  // Recherche réactive : filtre au fil de la saisie avec un léger debounce.
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === lastPushedSearch.current) return;
    const timer = setTimeout(() => {
      lastPushedSearch.current = trimmed;
      updateParams({ search: trimmed });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // Si c'est le premier montage et qu'on a des données serveur, on les utilise directement
    if (hydratedRef.current && initialListings !== undefined) {
      hydratedRef.current = false;
      setListings(initialListings);
      setLastPage(initialLastPage ?? 1);
      setTotal(initialTotal ?? 0);
      setLoading(false);
      return;
    }

    // Après le premier montage, tout changement de searchParams déclenche un fetch côté client
    let active = true;
    const fetchListings = async () => {
      setLoading(true);
      try {
        const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "https://api-next.livrezone.com").replace(/\/api\/?$/, "");
        const params = new URLSearchParams(searchParams.toString());
        params.set("limit", "12");
        if (userId) params.set("user_id", String(userId));
        const res = await fetch(`${baseUrl}/api/listings?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("API error");
        const json = await res.json();
        if (active) {
          setListings(Array.isArray(json.data) ? json.data : []);
          setLastPage(json.last_page || 1);
          setTotal(json.total || 0);
        }
      } catch {
        if (active) {
          setListings([]);
          setLastPage(1);
          setTotal(0);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchListings();
    return () => {
      active = false;
    };
  }, [searchParams, userId, initialListings, initialLastPage, initialTotal]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Au changement de page/recherche, positionne le scroll en haut de la liste.
  const scrollToListTop = () => {
    if (typeof window === "undefined") return;
    requestAnimationFrame(() => {
      listTopRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
    });
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = searchInput.trim();
    lastPushedSearch.current = q;
    updateParams({ search: q, sort: null });
  };

  return (
    <div ref={listTopRef} className="flex flex-col gap-6">
      {/* Toolbar : recherche + tri + vue */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white border border-gray-100 rounded-xl p-4 shadow-xs">
        <form
          onSubmit={handleSearchSubmit}
          className="w-full sm:flex-1 flex border border-gray-200 rounded-lg overflow-hidden h-12 sm:h-10 shadow-inner"
        >
          <input
            type="search"
            name="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Rechercher par ISBN, titre ou auteur"
            className="flex-1 min-w-0 px-3 text-xs bg-transparent focus:outline-none"
          />
          <button
            type="submit"
            className="bg-[#1a0a40] hover:bg-[#6D28D9] text-white font-bold px-4 text-xs transition-colors cursor-pointer"
          >
            Go
          </button>
        </form>

        <div className="flex items-center gap-3 justify-between sm:justify-start">
          <div className="flex items-center border border-gray-300 rounded-sm bg-white relative h-10">
            <select
              value={sortQ}
              onChange={(e) => updateParams({ sort: e.target.value })}
              className="h-full pl-2 pr-8 appearance-none bg-transparent text-xs font-bold text-gray-700 focus:outline-none cursor-pointer"
            >
              <option value="latest">Trier : les plus récents</option>
              <option value="price_asc">Trier par prix croissant</option>
              <option value="price_desc">Trier par prix décroissant</option>
            </select>
            <ChevronDown className="h-4 w-4 text-gray-500 absolute right-2.5 pointer-events-none" />
          </div>

          {/* Bascule Grille / Liste */}
          <div className="flex h-10 border border-gray-300 rounded-sm overflow-hidden">
            <button
              onClick={() => setView("grid")}
              className={`flex items-center justify-center gap-1.5 px-3 text-xs font-bold transition-colors cursor-pointer ${
                view === "grid"
                  ? "bg-[#1a0a40] text-white"
                  : "bg-white text-gray-500 hover:text-black"
              }`}
              aria-label="Vue grille"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("list")}
              className={`flex items-center justify-center gap-1.5 px-3 text-xs font-bold transition-colors cursor-pointer border-l border-gray-300 ${
                view === "list"
                  ? "bg-[#1a0a40] text-white"
                  : "bg-white text-gray-500 hover:text-black"
              }`}
              aria-label="Vue liste"
            >
              <ListIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6D28D9]"></div>
        </div>
      ) : listings.length > 0 ? (
        <div className="flex flex-col gap-8">
          {view === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-6">
              {listings.map((l) => (
                <BookCard
                  key={l.id}
                  title={l.title}
                  author={
                    l.book?.authors
                      ? Array.isArray(l.book.authors)
                        ? l.book.authors.join(", ")
                        : l.book.authors
                      : null
                  }
                  price={Number(l.price)}
                  discountPrice={l.discount_price != null ? Number(l.discount_price) : null}
                  cover={l.book?.cover_url || l.cover_source_url || null}
                  condition={l.book_condition}
                  url={buildListingPath(l)}
                  city={l.user?.profile?.city?.name || null}
                  listingId={l.id}
                  listing={{
                    isbn: l.isbn_13 || l.book?.isbn_13 || null,
                    user_id: l.user_id,
                    sellerNickname:
                      l.user?.profile?.nickname || `utilisateur-${l.user_id}`,
                    city: l.user?.profile?.city?.name || null,
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {listings.map((l) => (
                <ArticleListRow key={l.id} listing={l} />
              ))}
            </div>
          )}

          {lastPage > 1 && (
            <Pagination
              page={pageQ}
              lastPage={lastPage}
              onGo={(n) => {
                updateParams({ page: n });
                scrollToListTop();
              }}
            />
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center shadow-xs">
          <ShieldAlert className="h-16 w-16 text-gray-300 stroke-1 mx-auto mb-4" />
          <h3 className="text-lg font-black text-gray-950 mb-1">
            Aucune annonce trouvée
          </h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
            Nous n&apos;avons trouvé aucun livre correspondant à vos critères de
            filtres ou à votre terme de recherche.
          </p>
        </div>
      )}
    </div>
  );
}

function ArticleListRow({ listing }: { listing: ListingSummary }) {
  const cover = listing.book?.cover_url || listing.cover_source_url || null;
  const author = listing.book?.authors
    ? Array.isArray(listing.book.authors)
      ? listing.book.authors.join(", ")
      : listing.book.authors
    : null;
  const price = Number(listing.price);
  const discountPrice =
    listing.discount_price != null ? Number(listing.discount_price) : null;
  const hasDiscount = discountPrice !== null && discountPrice < price;
  const city = listing.user?.profile?.city?.name || null;

  return (
    <a
      href={buildListingPath(listing)}
      className="flex items-center gap-4 bg-white border border-gray-100 rounded-xl p-3 shadow-xs hover:shadow-md transition-shadow transaction-all group"
    >
      <div className="w-16 h-20 flex-shrink-0 bg-gray-50 rounded overflow-hidden">
        {cover ? (
          <div className="relative w-full h-full">
            <Image
              src={cover}
              alt={listing.title}
              fill
              className="object-contain p-1"
              unoptimized
            />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
            Livre
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-gray-900 group-hover:text-[#6D28D9] transition-colors line-clamp-2">
          {listing.title.charAt(0).toUpperCase() + listing.title.slice(1).toLowerCase()}
        </h3>
        {author && <p className="text-xs text-gray-500 mt-0.5 truncate">{author}</p>}
        <div className="mt-1 flex items-baseline gap-2">
          <div
            className={`text-[15px] font-black ${
              hasDiscount ? "text-[#F97316]" : "text-gray-950"
            }`}
          >
            {new Intl.NumberFormat("fr-FR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(hasDiscount ? discountPrice! : price)}{" "}
            <span className="text-[10px] font-medium text-gray-600">MAD</span>
          </div>
          {hasDiscount && (
            <span className="text-xs font-medium text-gray-400 line-through">
              {new Intl.NumberFormat("fr-FR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }).format(price)}
            </span>
          )}
        </div>
      </div>
      {city && <span className="text-xs text-gray-500 flex-shrink-0 hidden sm:block">{city}</span>}
    </a>
  );
}

function pickPages(current: number, last: number): Array<number | "..."> {
  if (last <= 7) {
    return Array.from({ length: last }, (_, i) => i + 1);
  }
  const set = new Set<number>([1, last, current - 2, current - 1, current, current + 1, current + 2]);
  const sorted = Array.from(set)
    .filter((n) => n >= 1 && n <= last)
    .sort((a, b) => a - b);
  const out: Array<number | "..."> = [];
  let prev = 0;
  for (const n of sorted) {
    if (n - prev > 1) out.push("...");
    out.push(n);
    prev = n;
  }
  return out;
}

function Pagination({
  page,
  lastPage,
  onGo,
}: {
  page: number;
  lastPage: number;
  onGo: (n: number) => void;
}) {
  const pages = pickPages(page, lastPage);
  return (
    <nav
      aria-label="Pagination"
      className="flex justify-center items-center gap-2 mt-4 font-bold text-xs"
    >
      <button
        disabled={page <= 1}
        onClick={() => onGo(page - 1)}
        className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`e${i}`} className="px-1 text-gray-400">
            …
          </span>
        ) : (
          <button
            key={p}
            disabled={p === page}
            onClick={() => onGo(p)}
            className={`px-3 py-2 border rounded-lg transition-colors cursor-pointer disabled:cursor-default ${
              p === page
                ? "border-[#1a0a40] bg-[#1a0a40] text-white"
                : "border-gray-200 hover:bg-gray-50 text-gray-700"
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        disabled={page >= lastPage}
        onClick={() => onGo(page + 1)}
        className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}