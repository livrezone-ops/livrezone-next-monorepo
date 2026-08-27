"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import api from "@/lib/axios";
import { buildListingPath, type ListingSummary } from "@/lib/listings-api";

interface HeaderSearchProps {
  onCloseMobile?: () => void;
  isMobile?: boolean;
}

export default function HeaderSearch({ onCloseMobile, isMobile = false }: HeaderSearchProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ListingSummary[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus automatique sur mobile quand la barre de recherche s'ouvre
  useEffect(() => {
    if (isMobile && inputRef.current) {
      // Un petit délai pour s'assurer que l'animation d'ouverture est terminée
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isMobile]);

  useEffect(() => {
    const term = searchQuery.trim();
    if (term.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    const delay = setTimeout(async () => {
      try {
        const res = await api.get(`/listings?search=${encodeURIComponent(term)}&limit=5&compact=1`);
        setSuggestions(res.data?.data || []);
        setShowSuggestions(true);
      } catch (err) {
        console.error("Erreur autocomplétion", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delay);
  }, [searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setShowSuggestions(false);
    if (onCloseMobile) onCloseMobile();
    router.push(`/annonces?search=${encodeURIComponent(q)}`);
  };

  const handleSuggestionClick = (listing: ListingSummary) => {
    setShowSuggestions(false);
    if (onCloseMobile) onCloseMobile();
    router.push(buildListingPath(listing));
  };

  return (
    <div className={`relative ${isMobile ? "w-full" : "flex-1 hidden lg:flex"}`}>
      <form
        onSubmit={handleSearchSubmit}
        className={`flex w-full border-2 border-black hover:border-gray-800 focus-within:border-[#6D28D9] rounded-xl transition-colors overflow-hidden ${isMobile ? "h-11" : "h-11"}`}
      >
        <input
          ref={inputRef}
          type="search"
          name="q"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true);
          }}
          placeholder="Rechercher par ISBN, titre ou auteur..."
          className={`flex-1 px-4 text-[13px] text-black placeholder-gray-400 focus:outline-none bg-white`}
          autoComplete="off"
        />
        <button
          type="submit"
          className={`shrink-0 text-white transition-colors flex items-center justify-center cursor-pointer ${
            isMobile ? "bg-[#6D28D9] hover:bg-violet-800 px-4.5" : "bg-black hover:bg-[#6D28D9] px-6"
          }`}
        >
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
          ) : (
            <Search className="h-4 w-4" strokeWidth={2.5} />
          )}
        </button>
      </form>

      {/* Menu déroulant des suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <>
          {/* Overlay invisible pour fermer au clic à l'extérieur */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowSuggestions(false)} 
          />
          <div className="absolute left-0 right-0 top-[calc(100%+4px)] bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto animate-in slide-in-from-top-2 duration-150">
            <ul className="py-2">
              {suggestions.map((listing) => {
                // Miniature en priorité (160 webp ~5-13 Ko vs original ~65 Ko) ;
                // le backend inclut déjà les fallbacks (book, source, placeholder)
                const cover =
                  listing.cover_thumbnail_url ||
                  listing.book?.cover_thumbnail_url ||
                  listing.book?.cover_url ||
                  listing.cover_source_url ||
                  null;
                const author = listing.book?.authors
                  ? Array.isArray(listing.book.authors)
                    ? listing.book.authors.join(", ")
                    : listing.book.authors
                  : null;
                const price = Number(listing.price);
                const discountPrice =
                  listing.discount_price != null ? Number(listing.discount_price) : null;
                const hasDiscount = discountPrice !== null && discountPrice < price;

                return (
                  <li
                    key={listing.id}
                    onClick={() => handleSuggestionClick(listing)}
                    className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer flex items-center gap-3 transition-colors border-b border-slate-50 last:border-0 group"
                  >
                    <div className="w-10 h-14 bg-slate-100 rounded flex items-center justify-center shrink-0 overflow-hidden relative shadow-sm border border-slate-200/60">
                      {cover ? (
                        <img
                          src={cover}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[8px] text-slate-400 text-center leading-tight">
                          Sans couv.
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 truncate group-hover:text-[#6D28D9] transition-colors">
                        {listing.title}
                      </p>
                      {author && (
                        <p className="text-[11px] font-medium text-slate-500 truncate">
                          {author}
                        </p>
                      )}
                      <div className="mt-0.5 flex items-baseline gap-2">
                        <span className={`text-xs font-black ${hasDiscount ? "text-[#F97316]" : "text-gray-900"}`}>
                          {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(hasDiscount ? discountPrice! : price)} MAD
                        </span>
                        {hasDiscount && (
                          <span className="text-[10px] text-gray-400 line-through">
                            {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price)}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
