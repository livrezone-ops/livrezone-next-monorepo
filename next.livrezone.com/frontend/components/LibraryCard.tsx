"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Store, MapPin, Star, ArrowRight } from "lucide-react";
import SmartCoverImage from "@/components/SmartCoverImage";
import type { LibraryItem } from "@/lib/libraries-api";

function resolveLogo(logo?: string | null): string | null {
  if (!logo) return null;
  if (/^https?:\/\//.test(logo)) return logo;
  const base = (process.env.NEXT_PUBLIC_API_URL || "https://api-next.livrezone.com").replace(/\/api\/?$/, "");
  return `${base}${logo}`;
}

const SUBSCRIPTION_BADGE: Record<string, { label: string; className: string } | null> = {
  premium: {
    label: "Premium",
    className: "bg-gradient-to-r from-amber-400 to-yellow-500 text-white",
  },
  pro: {
    label: "Pro",
    className: "bg-[#6D28D9] text-white",
  },
  free: {
    label: "Gratuit",
    className: "bg-gray-100 text-gray-500",
  },
};

function Stars({ value }: { value: number }) {
  const rounded = Math.round(value);
  return (
    <div className="flex items-center gap-0.5" aria-label={`Note ${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            i <= rounded
              ? "fill-amber-400 text-amber-400"
              : "fill-gray-200 text-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

interface LibraryCardProps {
  library: LibraryItem;
}

export default function LibraryCard({ library }: LibraryCardProps) {
  const [imgError, setImgError] = useState(false);
  const logo = resolveLogo(library.logo);
  const badge = library.subscription_type
    ? SUBSCRIPTION_BADGE[library.subscription_type] ?? null
    : null;
  const href = `/${library.nickname}`;

  return (
    <article className="group bg-white rounded-xl border border-gray-100 hover:border-[#6D28D9]/40 p-4 shadow-xs hover:shadow-md transition-all flex flex-col h-full">
      <div className="flex items-start gap-3.5">
        {/* Logo */}
        <Link
          href={href}
          className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-50 rounded-xl shrink-0 border border-gray-100 overflow-hidden relative flex items-center justify-center group-hover:scale-[1.03] transition-transform cursor-pointer shadow-2xs"
          title={library.name}
        >
          {logo && !imgError ? (
            <SmartCoverImage
              src={logo}
              alt={library.name}
              sizes="80px"
              className="object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-300 gap-1">
              <Store className="w-6 h-6 stroke-1" />
            </div>
          )}
        </Link>

        {/* Infos */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={href}
              className="font-bold text-gray-900 text-sm sm:text-base leading-snug line-clamp-2 group-hover:text-[#6D28D9] transition-colors block cursor-pointer"
              title={library.name}
            >
              {library.name}
            </Link>

            {badge && (
              <span
                className={`shrink-0 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full ${badge.className}`}
              >
                {badge.label}
              </span>
            )}
          </div>

          {library.city && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="truncate">{library.city.name}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Stars value={library.rating_average} />
            <span className="text-xs font-bold text-gray-700">
              {library.rating_average > 0 ? library.rating_average.toFixed(1) : "—"}
            </span>
            <span className="text-[11px] text-gray-400">
              ({library.rating_count})
            </span>
          </div>
        </div>
      </div>

      {/* Footer : nombre de publications + CTA */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-gray-500">
          {library.listing_count} publication{library.listing_count > 1 ? "s" : ""}
        </span>

        <Link
          href={href}
          className="h-8 px-3 rounded-lg bg-violet-50 text-[#6D28D9] hover:bg-[#6D28D9] hover:text-white transition-all text-xs font-bold flex items-center gap-1.5 border border-violet-200 shadow-2xs cursor-pointer"
          title={`Voir la librairie ${library.name}`}
        >
          <span>Visiter</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </article>
  );
}
