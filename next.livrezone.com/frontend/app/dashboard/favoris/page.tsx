"use client";

import Link from "next/link";
import { Heart, BookOpen } from "lucide-react";
import { useCommerce } from "@/lib/commerce-store";
import FavoriteCard from "@/components/FavoriteCard";

export default function DashboardFavorisPage() {
  const { wishlist } = useCommerce();

  return (
    <div className="space-y-6 pb-12">
      <header>
        <h1 className="text-2xl lg:text-3xl font-black text-[#1a0a40] flex items-center gap-2">
          <Heart className="h-7 w-7 text-red-500 fill-red-500" />
          Mes favoris
          <span className="text-sm font-bold text-gray-400 ml-1">({wishlist.length})</span>
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Retrouve les annonces que tu as sauvegardées.
        </p>
      </header>

      {wishlist.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 text-red-400 flex items-center justify-center mx-auto mb-4">
            <Heart className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            Votre wishlist est vide
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Sauvegardez vos coups de cœur en cliquant sur le cœur d&apos;une
            annonce pour les retrouver ici.
          </p>
          <Link
            href="/annonces"
            className="inline-flex items-center gap-2 h-11 px-6 rounded-lg text-xs font-bold text-white hover:opacity-95 transition-opacity"
            style={{ backgroundColor: "#6D28D9" }}
          >
            <BookOpen className="h-4 w-4" />
            Découvrir des livres
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {wishlist.map((l) => (
            <FavoriteCard key={l.id} listing={l} />
          ))}
        </div>
      )}
    </div>
  );
}
