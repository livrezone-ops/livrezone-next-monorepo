// Slider horizontal « Du même rayon » des fiches livre (09/09).
// Remplace la grille statique de BookCatalogCard (non responsive sur la fiche
// /books/{slug}) : 10 fiches max, 5 visibles en desktop, navigation par
// chevrons + scroll horizontal avec snap (même pattern que HorizontalGrid,
// adapté au catalogue — sans prix/état/panier : infos restreintes couverture,
// titre, auteur).
"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import SmartCoverImage from "@/components/SmartCoverImage";
import { bookHref } from "@/lib/book-slug";
import type { BookSearchItem } from "@/lib/books-api";

export default function RelatedBooksSlider({
  books,
  title = "Du même rayon",
}: {
  books: BookSearchItem[];
  title?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(books.length > 5);
  const [isHovered, setIsHovered] = useState(false);

  const checkScroll = () => {
    if (containerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
      setShowLeft(scrollLeft > 5);
      setShowRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const handleScroll = (direction: "left" | "right") => {
    if (containerRef.current) {
      const scrollAmount = containerRef.current.clientWidth * 0.8;
      containerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      checkScroll();
      container.addEventListener("scroll", checkScroll, { passive: true });
      window.addEventListener("resize", checkScroll);
    }
    return () => {
      if (container) {
        container.removeEventListener("scroll", checkScroll);
      }
      window.removeEventListener("resize", checkScroll);
    };
  }, [books]);

  if (!books || books.length === 0) {
    return null;
  }

  return (
    <section
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="mt-10 relative"
    >
      <h2 className="text-lg font-black text-[#1a0a40] mb-4">{title}</h2>

      {/* Chevron gauche (visible dès qu'on a scrollé) */}
      {showLeft && (
        <button
          onClick={() => handleScroll("left")}
          className={`absolute left-[-16px] top-[38%] -translate-y-1/2 z-10 bg-white border border-gray-200 shadow-md text-[#6D28D9] rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition-all duration-300 cursor-pointer ${
            isHovered ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
          }`}
          aria-label="Faire défiler à gauche"
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
        </button>
      )}

      {/* Chevron droit (visible tant qu'il reste du contenu) */}
      {showRight && (
        <button
          onClick={() => handleScroll("right")}
          className={`absolute right-[-16px] top-[38%] -translate-y-1/2 z-10 bg-white border border-gray-200 shadow-md text-[#6D28D9] rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition-all duration-300 cursor-pointer ${
            isHovered ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
          }`}
          aria-label="Faire défiler à droite"
        >
          <ChevronRight className="w-5 h-5" strokeWidth={2.5} />
        </button>
      )}

      {/* Piste scrollable : 5 cartes visibles en desktop, 2 en mobile */}
      <div
        ref={containerRef}
        className="flex overflow-x-auto snap-x snap-mandatory gap-5 scrollbar-none pb-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {books.map((book) => {
          const cover =
            book.cover_thumbnail_url_320 ||
            book.cover_thumbnail_url ||
            book.cover_url ||
            null;
          const author = book.authors
            ? Array.isArray(book.authors)
              ? book.authors.join(", ")
              : book.authors
            : null;
          const bookTitle = book.title || "Livre";
          return (
            <div
              key={book.id}
              className="snap-start flex-shrink-0 w-[45%] sm:w-[30%] md:w-[22%] lg:w-[calc(20%-16px)]"
            >
              <Link href={bookHref(book)} className="group block">
                <div className="relative w-full pb-[140%] mb-2 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden group-hover:shadow-md transition-shadow duration-300">
                  {cover ? (
                    <SmartCoverImage
                      src={cover}
                      alt={bookTitle}
                      className="object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 180px"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                      <BookOpen className="w-10 h-10 stroke-1.25" />
                    </div>
                  )}
                </div>
                {/* Infos restreintes : titre + auteur seulement */}
                <h3
                  className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug group-hover:text-[#6D28D9] transition-colors"
                  title={bookTitle}
                >
                  {bookTitle}
                </h3>
                {author && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">{author}</p>
                )}
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
