"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2, BookOpen } from "lucide-react";
import { useCommerce, buildListingUrl, type CartLine } from "@/lib/commerce-store";

const formatPrice = (val: number) =>
  new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);

export default function CartCard({ line }: { line: CartLine }) {
  const { updateCartQuantity, removeFromCart } = useCommerce();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const available = line.listing.availableQuantity ?? 99;
  const unitPrice = Number(line.listing.discountPrice ?? line.listing.price ?? 0);
  const maxQty = Math.max(1, Math.min(available, 99));
  const atMin = line.quantity <= 1;
  const atMax = line.quantity >= maxQty;
  const url = buildListingUrl(line.listing);
  const thumb = line.listing.coverThumb || line.listing.cover || null;

  return (
    <div className="p-4">
      <div className="flex items-center gap-4">
        <Link
          href={url}
          className="relative w-14 h-[76px] flex-shrink-0 bg-gray-50 rounded-md overflow-hidden"
        >
          {thumb ? (
            <Image
              src={thumb}
              alt={line.listing.title}
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

        <div className="flex-1 min-w-0">
          <Link
            href={url}
            className="line-clamp-1 text-[13px] font-bold text-gray-900 hover:text-[#6D28D9] transition-colors"
          >
            {line.listing.title}
          </Link>
          {line.listing.isbn && (
            <p className="text-[11px] text-gray-400 mt-0.5">
              ISBN {line.listing.isbn}
            </p>
          )}
          <p className="text-[13px] font-black text-gray-900 mt-1">
            {formatPrice(unitPrice)}{" "}
            <span className="text-[10px] font-medium text-gray-500">MAD</span>
          </p>
        </div>

        <button
          onClick={() => setConfirmOpen(true)}
          className="h-8 w-8 flex-shrink-0 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
          aria-label="Retirer du panier"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Quantité + disponibilité */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => updateCartQuantity(line.listingId, line.quantity - 1)}
            disabled={atMin}
            className="h-8 w-8 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            aria-label="Réduire la quantité"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-8 text-center text-[13px] font-bold text-gray-900">
            {line.quantity}
          </span>
          <button
            onClick={() => updateCartQuantity(line.listingId, line.quantity + 1)}
            disabled={atMax}
            className="h-8 w-8 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            aria-label="Augmenter la quantité"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <span className="text-[11px] text-gray-500">
          Quantité disponible :{" "}
          <strong className="text-gray-700">
            {line.listing.availableQuantity ?? "—"}
          </strong>
        </span>

        <span className="ml-auto text-[13px] font-black text-gray-900">
          {formatPrice(unitPrice * line.quantity)} MAD
        </span>
      </div>

      {/* Modal de confirmation de suppression */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in-95 duration-200 border border-gray-100">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mb-4 border border-rose-100">
                <Trash2 className="w-6 h-6 text-rose-500" />
              </div>
              <h3 className="text-lg font-black text-gray-900 mb-2">
                Retirer l&apos;article ?
              </h3>
              <p className="text-xs text-gray-500 mb-6 px-2">
                &laquo;&nbsp;{line.listing.title}&nbsp;&raquo; sera retiré de
                votre panier. Êtes-vous sûr ?
              </p>
              <div className="flex items-center gap-3 w-full">
                <button
                  onClick={() => setConfirmOpen(false)}
                  className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    removeFromCart(line.listingId);
                    setConfirmOpen(false);
                  }}
                  className="flex-1 py-2.5 font-bold text-xs rounded-xl text-white transition-colors cursor-pointer shadow-sm bg-rose-500 hover:bg-rose-600 border border-rose-600"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}