"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import BookCard from "./BookCard";

export interface SlimListing {
  id: number;
  title: string;
  price: number;
  discount_price: number | null;
  book_condition: string;
  authors: string | null;
  coverUrl: string | null;
  url: string;
  city: string | null;
}

interface HorizontalGridProps {
  title: string;
  listings: SlimListing[];
  viewAllUrl?: string;
}

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

export default function HorizontalGrid({
  title,
  listings,
  viewAllUrl = "#",
}: HorizontalGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);
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
  }, [listings]);

  if (!listings || listings.length === 0) {
    return null;
  }

  return (
    <section
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="w-full py-8 border-t border-gray-100 first-of-type:border-t-0 first-of-type:mt-0 relative"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl md:text-2xl font-extrabold text-gray-900 tracking-tight">
          {title}
        </h2>
        <Link
          href={viewAllUrl}
          className="text-xs md:text-sm text-gray-600 hover:text-[#6D28D9] font-bold transition-colors flex items-center gap-1 group/link"
        >
          Voir plus
          <ChevronRight className="w-4 h-4 transition-transform group-hover/link:translate-x-0.5" />
        </Link>
      </div>

      {/* Nav Buttons */}
      {showLeft && (
        <button
          onClick={() => handleScroll("left")}
          className={`absolute left-[-20px] top-[55%] -translate-y-1/2 z-10 bg-white border border-gray-200 shadow-md text-[#6D28D9] rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition-all duration-300 cursor-pointer ${
            isHovered ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
          }`}
          aria-label="Faire défiler à gauche"
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
        </button>
      )}

      {/* Navigation Right Button */}
      {showRight && (
        <button
          onClick={() => handleScroll("right")}
          className={`absolute right-[-20px] top-[55%] -translate-y-1/2 z-10 bg-white border border-gray-200 shadow-md text-[#6D28D9] rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition-all duration-300 cursor-pointer ${
            isHovered ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
          }`}
          aria-label="Faire défiler à droite"
        >
          <ChevronRight className="w-5 h-5" strokeWidth={2.5} />
        </button>
      )}

      {/* Scrollable Container */}
      <div
        ref={containerRef}
        className="flex overflow-x-auto snap-x snap-mandatory gap-5 scrollbar-none pb-4"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {listings.map((listing) => {
          return (
            <div
              key={listing.id}
              className="snap-start flex-shrink-0 w-[45%] sm:w-[30%] md:w-[22%] lg:w-[calc(20%-16px)]"
            >
              <BookCard
                title={listing.title}
                author={listing.authors}
                price={listing.price}
                discountPrice={listing.discount_price}
                cover={listing.coverUrl}
                condition={listing.book_condition}
                url={listing.url}
                city={listing.city}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
