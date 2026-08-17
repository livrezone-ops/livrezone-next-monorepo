"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Trash2, ShoppingCart, BookOpen } from "lucide-react";
import { useCommerce, buildListingUrl, type StoreListing } from "@/lib/commerce-store";

export default function FavoriteCard({ listing }: { listing: StoreListing }) {
  const { toggleWishlist, addToCart, isInCart } = useCommerce();
  const url = buildListingUrl(listing);
  const thumb = listing.coverThumb || listing.cover || null;

  const formatPrice = (val?: number | null) =>
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val ?? 0);

  return (
    <article className="flex gap-3 bg-white border border-gray-100 rounded-xl p-3 hover:shadow-md transition-shadow">
      {/* Couverture (thumbnail) */}
      <Link
        href={url}
        className="relative w-14 h-[76px] flex-shrink-0 bg-gray-50 rounded-md overflow-hidden"
      >
        {thumb ? (
          <Image
            src={thumb}
            alt={listing.title}
            fill
            sizes="56px"
            className="object-contain p-1"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-300">
            <BookOpen className="h-6 w-6" />
          </div>
        )}
      </Link>

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <h3 className="line-clamp-2 text-[12px] font-bold text-gray-900 leading-snug hover:text-[#6D28D9] transition-colors">
          <Link href={url}>{listing.title}</Link>
        </h3>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[13px] font-black text-gray-950">
            {formatPrice(listing.discountPrice ?? listing.price)}{" "}
            <span className="text-[9px] font-medium text-gray-500">MAD</span>
          </span>
          {listing.discountPrice != null &&
            listing.discountPrice < (listing.price ?? 0) && (
              <span className="text-[10px] font-semibold text-gray-400 line-through">
                {formatPrice(listing.price)}
              </span>
            )}
        </div>

        {/* Actions compactes */}
        <div className="mt-2 flex items-center gap-1.5">
          {isInCart(listing.id) ? (
            <span className="flex-1 h-7 rounded-md text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              Au panier
            </span>
          ) : (
            <button
              onClick={() => addToCart(listing)}
              className="flex-1 h-7 rounded-md text-[10px] font-bold text-white hover:opacity-95 transition-opacity flex items-center justify-center gap-1 cursor-pointer"
              style={{ backgroundColor: "#F97316" }}
            >
              <ShoppingCart className="h-3 w-3" />
              Panier
            </button>
          )}
          <button
            onClick={() => toggleWishlist(listing)}
            className="h-7 w-7 rounded-md border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 flex items-center justify-center transition-colors cursor-pointer"
            title="Supprimer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}