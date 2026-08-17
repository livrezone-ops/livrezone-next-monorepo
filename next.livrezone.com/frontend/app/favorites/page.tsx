"use client";

import React from "react";
import Link from "next/link";
import { Heart, BookOpen } from "lucide-react";
import { useCommerce } from "@/lib/commerce-store";
import FavoriteCard from "@/components/FavoriteCard";

export default function FavoritesPage() {
  const { wishlist } = useCommerce();

  return (
    <div className="w-[90%] max-w-7xl mx-auto py-10">
      <h1 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2">
        <Heart className="h-6 w-6 text-red-500 fill-red-500" />
        Mes favoris
        <span className="text-sm font-bold text-gray-400 ml-1">
          ({wishlist.length})
        </span>
      </h1>

      {wishlist.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
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