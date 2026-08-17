"use client";

import React from "react";
import Link from "next/link";
import {
  ShoppingCart,
  BookOpen,
  Truck,
  Store,
  MessageCircle,
} from "lucide-react";
import { useCommerce } from "@/lib/commerce-store";
import CartCard from "@/components/CartCard";

function cleanPhone(raw?: string | null): string {
  let phone = (raw || "").replace(/[^0-9]/g, "");
  if (phone.startsWith("0")) phone = "212" + phone.substring(1);
  return phone;
}

export default function CartPage() {
  const { cartSellers, cartCount, isAuthenticated } = useCommerce();

  const formatPrice = (val: number) =>
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);

  const total = cartSellers.reduce((s, g) => s + g.subtotal, 0);

  if (cartCount === 0) {
    return (
      <div className="w-[90%] max-w-7xl mx-auto py-10">
        <h1 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2">
          <ShoppingCart className="h-6 w-6 text-[#F97316]" />
          Mon panier
        </h1>
        <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-orange-50 text-[#F97316] flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            Votre panier est vide
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Ajoutez des livres à votre panier pour préparer votre commande.
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
      </div>
    );
  }

  return (
    <div className="w-[90%] max-w-7xl mx-auto py-10">
      <h1 className="text-2xl font-black text-gray-900 mb-2 flex items-center gap-2">
        <ShoppingCart className="h-6 w-6 text-[#F97316]" />
        Mon panier
        <span className="text-sm font-bold text-gray-400 ml-1">
          ({cartCount} articles)
        </span>
      </h1>

      {!isAuthenticated && (
        <p className="text-xs text-gray-500 mb-6 flex items-center gap-1.5">
          <Truck className="h-3.5 w-3.5" />
          En tant que visiteur, votre panier est valable 24h. Connectez-vous
          pour le sauvegarder définitivement.
        </p>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Liste des vendeurs */}
        <div className="flex-1 flex flex-col gap-6">
          {cartSellers.map((group, gi) => {
            const sellerPhone = cleanPhone(group.seller?.phone);
            const waMessage = encodeURIComponent(
              `Bonjour ${group.seller?.nickname ?? ""},\n\nJe souhaite confirmer ma commande sur LivreZone :\n` +
                group.items
                  .map(
                    (i) =>
                      `- ${i.listing.title} x${i.quantity} = ${formatPrice(
                        Number(i.listing.discountPrice ?? i.listing.price ?? 0) *
                          i.quantity
                      )} MAD`
                  )
                  .join("\n") +
                `\n\nTotal : ${formatPrice(group.subtotal)} MAD`
            );
            const waUrl = sellerPhone
              ? `https://wa.me/${sellerPhone}?text=${waMessage}`
              : null;

            return (
              <div
                key={gi}
                className="bg-white border border-gray-100 rounded-xl overflow-hidden"
              >
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50/70 border-b border-gray-100">
                  <Store className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  <span className="text-[13px] font-bold text-gray-900 truncate">
                    Vendeur {group.seller?.nickname || "LivreZone"}
                  </span>
                  {group.seller?.city && (
                    <span className="text-[11px] text-gray-500 hidden sm:inline">
                      · {group.seller.city}
                    </span>
                  )}
                  <span className="ml-auto text-[11px] font-bold text-gray-500 flex-shrink-0">
                    {group.itemCount} article(s)
                  </span>
                </div>

                <div className="divide-y divide-gray-100">
                  {group.items.map((item) => (
                    <CartCard key={item.listingId} line={item} />
                  ))}
                </div>

                <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
                  {waUrl ? (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg text-[11px] font-bold transition-colors cursor-pointer shadow-sm"
                      style={{ backgroundColor: "#25D366", color: "#fff" }}
                    >
                      <MessageCircle className="h-4 w-4" />
                      Envoyer le panier au vendeur (WhatsApp)
                    </a>
                  ) : (
                    <span className="text-[11px] text-gray-400">
                      Contact du vendeur indisponible pour WhatsApp.
                    </span>
                  )}
                  <span className="sm:ml-auto text-[13px] font-bold text-gray-900">
                    Sous-total :{" "}
                    <span className="font-black">
                      {formatPrice(group.subtotal)} MAD
                    </span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Résumé */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <div className="bg-white border border-gray-100 rounded-xl p-5 lg:sticky lg:top-24">
            <h2 className="text-sm font-bold text-gray-900 mb-4">Résumé</h2>
            <div className="flex justify-between text-[13px] text-gray-600 mb-2">
              <span>Articles</span>
              <span>{cartCount}</span>
            </div>
            <div className="flex justify-between text-[13px] font-bold text-gray-900 mb-2">
              <span>Total</span>
              <span>{formatPrice(total)} MAD</span>
            </div>
            <p className="text-[11px] text-gray-400 mb-4">
              Frais de livraison calculés par le vendeur.
            </p>
            <button
              className="w-full h-11 rounded-lg text-xs font-bold text-white hover:opacity-95 transition-opacity cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: "#F97316" }}
              disabled
            >
              Passer la commande
            </button>
            <p className="text-center text-[10px] text-gray-400 mt-3">
              Un service de récupération et de livraison sera bientôt
              disponible par le site
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}