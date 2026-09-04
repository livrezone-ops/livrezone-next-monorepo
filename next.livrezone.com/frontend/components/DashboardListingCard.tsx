"use client";

import React from "react";
import Link from "next/link";
import { BookOpen, Edit } from "lucide-react";
import SmartCoverImage from "@/components/SmartCoverImage";

export interface DashboardListing {
  id: number;
  user_id?: number;
  book_id?: number | null;
  isbn_13?: string | null;
  title: string;
  price: number;
  discount_price?: number | null;
  book_condition?: string | null;
  status: string;
  cover_path?: string | null;
  cover_url?: string | null;
  cover_thumbnail_url?: string | null;
  cover_source_url?: string | null;
  book?: {
    cover_thumbnail_url?: string | null;
    cover_url?: string | null;
    authors?: string[] | string | null;
  } | null;
  category?: {
    id?: number;
    name_fr: string;
  } | null;
  created_at: string;
}

interface DashboardListingCardProps {
  listing: DashboardListing;
  isSelected: boolean;
  onToggleSelect: (id: number) => void;
  onStartEdit: (listing: DashboardListing) => void;
  renderActions: (listing: DashboardListing, bordered: boolean) => React.ReactNode;
  statusBadge: (listing: DashboardListing) => { label: string; className: string };
  buildListingUrl: (listing: DashboardListing) => string;
  primaryCoverUrl: (listing: DashboardListing) => string | null;
  /** URL de secours (couverture originale) si la miniature échoue —
   *  retry géré nativement par SmartCoverImage */
  fallbackCoverUrl: (listing: DashboardListing) => string | null;
}

export default function DashboardListingCard({
  listing,
  isSelected,
  onToggleSelect,
  onStartEdit,
  renderActions,
  statusBadge,
  buildListingUrl,
  primaryCoverUrl,
  fallbackCoverUrl,
}: DashboardListingCardProps) {
  const coverUrl = primaryCoverUrl(listing);
  const badge = statusBadge(listing);

  return (
    <div
      className={`bg-white rounded-xl border border-gray-150 p-4 flex flex-col gap-3 relative shadow-xs hover:shadow-md transition-shadow ${
        isSelected ? "border-[#6D28D9]/40 bg-violet-50/10" : ""
      }`}
    >
      {/* Checkbox badge */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(listing.id)}
          className="rounded border-gray-300 text-[#6D28D9] focus:ring-[#6D28D9] cursor-pointer"
        />
        {listing.book_condition === "neuf" ? (
          <span className="text-[8px] bg-orange-500 text-white font-bold px-1.5 py-0.5 rounded-xs uppercase tracking-wide">
            Neuf
          </span>
        ) : (
          <span className="text-[8px] bg-teal-600 text-white font-bold px-1.5 py-0.5 rounded-xs uppercase tracking-wide">
            Occasion
          </span>
        )}
      </div>

      {/* Status flag */}
      <div className="absolute top-3 right-3">
        <span className={`text-[9px] font-bold px-2 py-0.5 border rounded-sm ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      {/* Image cover & Details */}
      <div className="flex gap-3 pt-6 border-b border-gray-100 pb-3">
        <Link
          href={buildListingUrl(listing)}
          className="relative w-12 h-16 flex-shrink-0 bg-gray-50 flex items-center justify-center rounded border border-gray-150 text-gray-300 cursor-pointer hover:border-[#6D28D9] transition-colors"
        >
          {coverUrl ? (
            <SmartCoverImage
              src={coverUrl}
              alt={listing.title}
              className="object-contain"
              sizes="48px"
              fallbackSrc={fallbackCoverUrl(listing)}
            />
          ) : (
            <BookOpen className="w-5 h-5 stroke-1" />
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 group/title">
            <Link
              href={buildListingUrl(listing)}
              className="font-bold text-gray-950 text-sm truncate hover:text-[#6D28D9]"
            >
              {listing.title}
            </Link>
            <button
              onClick={() => onStartEdit(listing)}
              className="text-gray-300 hover:text-[#6D28D9] p-0.5 transition-colors cursor-pointer"
              title="Modifier"
            >
              <Edit className="w-3 h-3" />
            </button>
          </div>
          <span className="text-[10px] text-gray-400 block mt-0.5 font-mono">
            ISBN: {listing.isbn_13 || "N/A"}
          </span>
          {listing.category && (
            <span className="text-[9px] text-[#6D28D9] font-bold block mt-0.5">
              {listing.category.name_fr}
            </span>
          )}
        </div>
      </div>

      {/* Price & Actions */}
      <div className="flex items-center justify-between mt-auto">
        <div>
          {listing.discount_price ? (
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-gray-400 line-through block leading-none mb-0.5">
                {Number(listing.price).toFixed(2)}
              </span>
              <span className="font-extrabold text-[#6D28D9] text-base">
                {Number(listing.discount_price).toFixed(2)} MAD
              </span>
            </div>
          ) : (
            <span className="font-extrabold text-gray-950 text-base">
              {Number(listing.price).toFixed(2)} MAD
            </span>
          )}
        </div>

        <div className="flex gap-1.5">
          {renderActions(listing, true)}
        </div>
      </div>
    </div>
  );
}
