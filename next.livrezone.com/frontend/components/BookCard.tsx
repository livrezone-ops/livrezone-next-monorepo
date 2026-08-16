"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, ShoppingCart, MapPin, BookOpen } from "lucide-react";

interface BookCardProps {
  title: string;
  author?: string | null;
  price: number;
  discountPrice?: number | null;
  cover?: string | null;
  condition?: "neuf" | "occas" | string | null;
  url: string;
  city?: string | null;
}

export default function BookCard({
  title,
  author = null,
  price,
  discountPrice = null,
  cover = null,
  condition = null,
  url = "#",
  city = null,
}: BookCardProps) {
  
  // Format prices
  const formatPrice = (val: number) => {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const hasDiscount = discountPrice !== null && discountPrice < price;

  return (
    <article className="flex flex-col items-start bg-transparent font-sans group relative w-full">
      {/* Image Container */}
      <div className="relative w-full mb-3 block overflow-hidden rounded-md bg-gray-50 border border-gray-100 group-hover:shadow-md transition-shadow duration-300">
        
        {/* Badges */}
        {condition === "neuf" && (
          <div className="absolute left-2.5 top-2.5 z-10 rounded-xs bg-[#F97316] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-xs transition-all duration-300 group-hover:-rotate-3 group-hover:scale-105 pointer-events-none">
            Neuf
          </div>
        )}
        {condition === "occas" && (
          <div className="absolute left-2.5 top-2.5 z-10 rounded-xs bg-teal-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-xs transition-all duration-300 group-hover:-rotate-3 group-hover:scale-105 pointer-events-none">
            Occasion
          </div>
        )}

        {/* Cover Image with Link */}
        <Link href={url} className="block relative w-full pb-[140%] overflow-hidden">
          {cover ? (
            <Image
              src={cover}
              alt={title}
              fill
              sizes="(max-width: 640px) 140px, (max-width: 1024px) 200px, 300px"
              className="object-contain p-3 scale-95 transition-transform duration-500 ease-out group-hover:scale-100"
              unoptimized
            />
          ) : (
            <div className="absolute left-0 top-0 flex h-full w-full items-center justify-center bg-slate-100 text-slate-400 scale-95 transition-transform duration-500 ease-out group-hover:scale-100">
              <BookOpen className="h-10 w-10 stroke-1.25" />
            </div>
          )}
        </Link>

        {/* Hover Actions (Desktop overlay, translates up) */}
        <div className="absolute bottom-0 left-0 flex w-full transition-all duration-300 
                    translate-y-full opacity-0 
                    group-hover:translate-y-0 group-hover:opacity-100">
          
          {/* Wishlist Button */}
          <button 
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center border-r border-gray-100 bg-white text-gray-800 transition-colors hover:bg-gray-50 hover:text-red-500 cursor-pointer" 
            title="Ajouter aux favoris"
          >
            <Heart className="h-4.5 w-4.5" />
          </button>
          
          {/* Add to Cart Button */}
          <button 
            className="flex h-10 flex-grow items-center justify-center gap-2 bg-[#F97316]/90 hover:bg-[#F97316] backdrop-blur-md text-xs font-semibold text-white transition-colors cursor-pointer" 
            title="Ajouter au panier"
          >
            <ShoppingCart className="h-4 w-4" />
            Panier
          </button>
        </div>
      </div>

      {/* Info Container */}
      <div className="w-full px-1">
        {/* Title */}
        <h3 
          className="line-clamp-2 min-h-[40px] text-[15px] font-bold leading-tight text-gray-900 hover:text-[#6D28D9] transition-colors mb-1 w-full" 
          title={title}
        >
          <Link href={url} className="hover:underline">
            {title.charAt(0).toUpperCase() + title.slice(1).toLowerCase()}
          </Link>
          {author && (
            <span className="block text-[12px] font-normal text-gray-500 mt-0.5 truncate">
              {author}
            </span>
          )}
        </h3>
        
        {/* Price Tag */}
        <div className="mt-1 flex items-baseline gap-2">
          {hasDiscount ? (
            <>
              <div className="text-[17px] font-black text-[#F97316]">
                {formatPrice(discountPrice!)} <span className="text-[10px] font-medium text-gray-600">MAD</span>
              </div>
              <div className="text-[12px] font-semibold text-gray-400 line-through">
                {formatPrice(price)}
              </div>
            </>
          ) : (
            <div className="text-[17px] font-black text-gray-950">
              {formatPrice(price)} <span className="text-[10px] font-medium text-gray-600">MAD</span>
            </div>
          )}
        </div>

        {/* City Location */}
        {city && (
          <div className="mt-1.5 text-[11px] text-gray-500 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-gray-400" />
            <span className="truncate">{city}</span>
          </div>
        )}
      </div>
    </article>
  );
}
