"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  Heart, ShoppingCart, Share2, Phone, MessageSquare, 
  Truck, MapPin, Star, BookOpen, 
  MessageCircle, Copy, X, Store, CheckCircle
} from "lucide-react";
import { useCommerce } from "@/lib/commerce-store";

interface Listing {
  id: number;
  title: string;
  description: string;
  book_condition: string;
  price: number;
  discount_price?: number | null;
  cover_path?: string | null;
  cover_source_url?: string | null;
  user: {
    id: number;
    name: string;
    profile?: {
      nickname: string;
      phone?: string | null;
      rating_average?: number;
      rating_count?: number;
      city?: {
        name: string;
      } | null;
    } | null;
  };
  book?: {
    isbn_13: string;
    publisher?: string | null;
    publication_date?: string | null;
    authors?: string[] | null;
    page_count?: number | null;
    cover_path?: string | null;
    cover_url?: string | null;
  } | null;
  category?: {
    name_fr: string;
    parent?: {
      name_fr: string;
    } | null;
  } | null;
  level?: {
    name_fr: string;
  } | null;
  subject?: {
    name_fr: string;
  } | null;
}

interface ListingDetailsCardProps {
  listing: Listing;
}

export default function ListingDetailsCard({ listing }: ListingDetailsCardProps) {
  const [activeTab, setActiveTab] = useState<"description" | "details">("description");
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const { isInWishlist, isInCart, toggleWishlist, addToCart } = useCommerce();
  const isFav = isInWishlist(listing.id);
  const isInCartBool = isInCart(listing.id);

  const price = listing.discount_price ?? listing.price;
  const isDiscounted = listing.discount_price !== undefined && listing.discount_price !== null && listing.discount_price < listing.price;
  
  // Calculate discount percentage
  const discountPct = isDiscounted 
    ? Math.round((1 - (listing.discount_price ?? 0) / listing.price) * 100) 
    : 0;

  // Format phone
  const rawPhone = listing.user.profile?.phone || "";
  let cleanPhone = rawPhone.replace(/[^0-9]/g, "");
  if (cleanPhone.startsWith("0")) {
    cleanPhone = "212" + cleanPhone.substring(1);
  }

  // Predefined share text
  const shareText = `📚 *${listing.title}*\n💰 Prix : ${price} MAD\nDécouvrez ce livre sur LivreZone ici 👇\n`;
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert("Lien copié dans le presse-papiers !");
      setShareOpen(false);
    });
  };

  const handleFacebookShare = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, "_blank");
    setShareOpen(false);
  };

  const handleWhatsAppShare = () => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + shareUrl)}`, "_blank");
    setShareOpen(false);
  };

  const formatPubDate = (dateStr?: string | null) => {
    if (!dateStr) return "N/A";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("fr-FR");
    } catch {
      return dateStr;
    }
  };

  const authors = listing.book?.authors ? listing.book.authors.join(", ") : null;
  // Priorité : cover_url du proxy Laravel > cover_source_url > null
  const coverUrl = listing.book?.cover_url
    || listing.cover_source_url
    || null;

  const sellerNickname = listing.user.profile?.nickname || `utilisateur-${listing.user.id}`;
  const sellerPath = `/${sellerNickname}`;

  const handleToggleFav = () => {
    toggleWishlist({
      id: listing.id,
      title: listing.title,
      price: listing.price,
      discountPrice: listing.discount_price ?? null,
      cover: coverUrl ?? null,
      isbn: listing.book?.isbn_13 ?? null,
      user_id: listing.user.id,
      sellerNickname,
      city: listing.user.profile?.city?.name ?? null,
    });
  };

  const handleAddToCart = () => {
    addToCart({
      id: listing.id,
      title: listing.title,
      price: listing.price,
      discountPrice: listing.discount_price ?? null,
      cover: coverUrl ?? null,
      isbn: listing.book?.isbn_13 ?? null,
      user_id: listing.user.id,
      sellerNickname,
      city: listing.user.profile?.city?.name ?? null,
    });
  };

  return (
    <div className="max-w-6xl mx-auto font-sans text-gray-800">
      
      {/* Top Details Grid */}
      <div className="flex flex-col md:flex-row gap-8 md:gap-12 mb-12">
        
        {/* Left Column: Cover Preview */}
        <div className="w-full md:w-5/12 flex-shrink-0">
          <div className="relative w-full pb-[130%] bg-white border border-gray-200 rounded-lg shadow-xs overflow-hidden">
            {/* Condition Badge */}
            {listing.book_condition === "neuf" && (
              <div className="absolute left-0 top-0 z-10 bg-emerald-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white">
                Neuf
              </div>
            )}
            {listing.book_condition === "occas" && (
              <div className="absolute left-0 top-0 z-10 bg-[#6D28D9] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white">
                Occasion
              </div>
            )}

            {coverUrl ? (
              <Image 
                src={coverUrl} 
                alt={listing.title} 
                fill
                className="object-contain p-6"
                unoptimized
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
                <BookOpen className="h-16 w-16 mb-2 stroke-1" />
                <span className="text-[13px] font-medium">Image indisponible</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Listing Metadata */}
        <div className="w-full md:w-7/12 flex flex-col">
          {/* Title */}
          <h1 className="text-2xl sm:text-[32px] leading-tight font-black text-gray-900 mb-2 hover:text-[#6D28D9] transition-colors cursor-pointer">
            {listing.title}
          </h1>

          {/* Author */}
          {authors && (
            <div className="text-sm text-gray-600 mb-4 pb-4 border-b border-gray-100">
              Par (auteur) <span className="text-gray-900 font-bold">{authors}</span>
            </div>
          )}

          {/* ISBN */}
          {listing.book?.isbn_13 && (
            <div className="text-xs text-gray-500 mb-6">
              ISBN / EAN : <span className="text-gray-900 font-bold">{listing.book.isbn_13}</span>
            </div>
          )}

          {/* Price Box */}
          <div className="mb-8">
            <div className="flex items-end gap-3">
              <span className="text-3xl sm:text-[36px] font-black text-gray-950 leading-none">
                {price} <span className="text-xl font-bold text-gray-700 ml-1">MAD</span>
              </span>
              {isDiscounted && (
                <>
                  <span className="text-lg text-gray-400 line-through mb-1 font-medium">
                    {listing.price}
                  </span>
                  <span className="ml-2 bg-emerald-100 text-emerald-800 text-[11px] font-extrabold px-2 py-1 rounded-xs mb-1.5 uppercase">
                    -{discountPct}%
                  </span>
                </>
              )}
              <div className="ml-auto flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 mb-1">
                <CheckCircle className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-wide">Disponible</span>
              </div>
            </div>
          </div>

          {/* Delivery & City Block */}
          <div className="py-4 border-y border-gray-100 mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm sm:text-base">
              {/* Delivery info */}
              <div className="flex items-start gap-2.5">
                <Truck className="w-5 h-5 text-gray-500 mt-0.5" />
                <div>
                  <span className="font-semibold block text-gray-400 text-xs uppercase tracking-wider">Livraison</span>
                  <span className="text-black font-semibold">Disponible partout au Maroc</span>
                </div>
              </div>

              {/* City info */}
              {listing.user.profile?.city?.name && (
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-gray-400 text-xs uppercase tracking-wider">Ville</span>
                    <span className="text-black font-semibold">{listing.user.profile.city.name}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions (Favorites / Add to Cart / Share) */}
          <div className="flex flex-wrap items-center gap-6 mb-6 text-sm text-gray-600 font-bold relative">
            <button
              onClick={handleToggleFav}
              className={`flex items-center gap-2 transition-colors cursor-pointer ${
                isFav ? "text-red-500" : "hover:text-[#6D28D9]"
              }`}
              aria-pressed={isFav}
            >
              <Heart className={`w-5 h-5 ${isFav ? "fill-red-500 text-red-500" : ""}`} />
              {isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
            </button>
            {isInCartBool ? (
              <span className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full text-sm font-bold">
                <CheckCircle className="w-5 h-5" />
                Déjà au panier
              </span>
            ) : (
              <button
                onClick={handleAddToCart}
                className="flex items-center gap-2 transition-colors cursor-pointer hover:text-[#F97316]"
              >
                <ShoppingCart className="w-5 h-5" />
                Ajouter au panier
              </button>
            )}
            
            <div className="relative">
              <button 
                onClick={() => setShareOpen(!shareOpen)}
                className="flex items-center gap-2 hover:text-[#6D28D9] transition-colors cursor-pointer focus:outline-none"
              >
                <Share2 className="w-5 h-5" />
                Partager
              </button>
              {shareOpen && (
                <div className="absolute left-0 top-full mt-2 w-48 bg-white border border-gray-100 shadow-xl rounded-lg z-20 py-1 text-xs text-black animate-in fade-in slide-in-from-top-2 duration-150">
                  <button 
                    onClick={handleFacebookShare}
                    className="flex w-full text-left px-4 py-2.5 hover:bg-gray-50 text-[#1877F2] font-semibold items-center gap-2"
                  >
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z"/></svg> Facebook
                  </button>
                  <button 
                    onClick={handleWhatsAppShare}
                    className="flex w-full text-left px-4 py-2.5 hover:bg-gray-50 text-[#25D366] font-semibold items-center gap-2"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </button>
                  <button 
                    onClick={handleCopyLink}
                    className="flex w-full text-left px-4 py-2.5 hover:bg-gray-50 text-gray-700 font-semibold items-center gap-2 border-t border-gray-50 mt-1 pt-2"
                  >
                    <Copy className="h-4 w-4" /> Copier le lien
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Seller / Contact Box */}
          <div className="pt-8 mt-5 border-t border-gray-100">
            <div className="flex items-end flex-wrap gap-2 mb-4">
              <span className="font-semibold text-gray-400 text-xs uppercase tracking-wider">Vendeur</span>
              <Link href={sellerPath} className="text-[#1a0a40] font-black text-2xl leading-none hover:text-[#6D28D9] transition-colors">
                {listing.user.profile?.nickname || listing.user.name}
              </Link>
              <div className="ml-auto flex items-center gap-2">
                <div className="bg-white rounded-lg border border-gray-100 px-2.5 py-1 flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <span className="font-bold text-gray-800 text-sm leading-none">
                    {listing.user.profile?.rating_count && listing.user.profile.rating_count > 0
                      ? Number(listing.user.profile.rating_average ?? 0).toFixed(1)
                      : "-"}
                  </span>
                  {listing.user.profile?.rating_count && listing.user.profile.rating_count > 0 && (
                    <span className="text-gray-400 text-[11px] font-medium">
                      ({listing.user.profile.rating_count})
                    </span>
                  )}
                </div>
              </div>
            </div>

            <span className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Contacter le vendeur</span>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* WhatsApp Call */}
              <a 
                href={cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent("Bonjour, je suis intéressé")}%0A${encodeURIComponent(shareUrl)}` : "#"} 
                target="_blank" 
                rel="noopener noreferrer"
                className="group h-11 rounded-lg hover:opacity-95 text-xs font-bold transition-opacity flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                style={{ backgroundColor: "#1a0a40", color: "#4ade80" }}
              >
                <MessageCircle className="w-4 h-4 text-[#4ade80]" />
                WhatsApp
              </a>

              {/* Direct Phone Call */}
              <button 
                onClick={() => setShowPhoneModal(true)}
                className="h-11 rounded-lg bg-white border border-[#1a0a40] text-[#1a0a40] hover:bg-violet-50 text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Phone className="w-4 h-4" />
                Téléphone
              </button>

              {/* Chat Message */}
              <Link 
                href={`/chat?user=${listing.user.id}`}
                className="h-11 rounded-lg bg-white border border-[#1a0a40] text-[#1a0a40] hover:bg-violet-50 text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <MessageSquare className="w-4 h-4" />
                Message
              </Link>
            </div>

            {/* Visit Seller Page */}
            <div className="mt-6">
              <Link
                href={sellerPath}
                className="group flex items-center justify-center w-full h-11 border border-gray-200 text-gray-700 bg-gray-50 hover:bg-violet-50 hover:border-[#6D28D9] hover:text-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] font-bold text-xs transition-all duration-200 rounded-lg"
              >
                <Store className="w-5 h-5 mr-2 text-gray-400 group-hover:text-[#6D28D9] transition-colors" />
                Visiter la page du vendeur
              </Link>
            </div>
          </div>

        </div>
      </div>

      {/* Tabs Panel */}
      <div className="border-t border-gray-200 pt-2 mt-8">
        <div className="flex border-b border-gray-100">
          <button 
            onClick={() => setActiveTab("description")}
            className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === "description" 
                ? "border-[#6D28D9] text-[#6D28D9]" 
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            Description
          </button>
          <button 
            onClick={() => setActiveTab("details")}
            className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === "details" 
                ? "border-[#6D28D9] text-[#6D28D9]" 
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            Plus d&apos;infos
          </button>
        </div>

        <div className="py-8">
          {activeTab === "description" ? (
            <div className="text-sm text-gray-700 leading-relaxed max-w-4xl whitespace-pre-line">
              {listing.description || <p className="italic text-gray-400">Aucune description fournie par le vendeur.</p>}
            </div>
          ) : (
            <div className="max-w-xl">
              <table className="w-full text-left text-sm border-collapse">
                <tbody>
                  <tr className="border-b border-gray-100 last:border-0">
                    <th className="py-3 font-semibold text-gray-400 w-1/3 align-top">Auteur</th>
                    <td className="py-3 font-bold text-gray-900 w-2/3">{authors || "N/A"}</td>
                  </tr>
                  <tr className="border-b border-gray-100 last:border-0">
                    <th className="py-3 font-semibold text-gray-400 w-1/3 align-top">Éditeur</th>
                    <td className="py-3 font-bold text-gray-900 w-2/3">{listing.book?.publisher || "N/A"}</td>
                  </tr>
                  <tr className="border-b border-gray-100 last:border-0">
                    <th className="py-3 font-semibold text-gray-400 w-1/3 align-top">Publication</th>
                    <td className="py-3 font-bold text-gray-900 w-2/3">{formatPubDate(listing.book?.publication_date)}</td>
                  </tr>
                  <tr className="border-b border-gray-100 last:border-0">
                    <th className="py-3 font-semibold text-gray-400 w-1/3 align-top">Pages</th>
                    <td className="py-3 font-bold text-gray-900 w-2/3">{listing.book?.page_count || "N/A"}</td>
                  </tr>
                  <tr className="border-b border-gray-100 last:border-0">
                    <th className="py-3 font-semibold text-gray-400 w-1/3 align-top">Matière</th>
                    <td className="py-3 font-bold text-gray-900 w-2/3">{listing.subject?.name_fr || "N/A"}</td>
                  </tr>
                  <tr className="border-b border-gray-100 last:border-0">
                    <th className="py-3 font-semibold text-gray-400 w-1/3 align-top">Catégorie</th>
                    <td className="py-3 font-bold text-gray-900 w-2/3">{listing.category?.name_fr || "N/A"}</td>
                  </tr>
                  <tr className="border-b border-gray-100 last:border-0">
                    <th className="py-3 font-semibold text-gray-400 w-1/3 align-top">Niveau</th>
                    <td className="py-3 font-bold text-gray-900 w-2/3">{listing.level?.name_fr || "N/A"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Phone Call Modal Overlay */}
      {showPhoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm p-4 mx-auto animate-in zoom-in-95 duration-200">
            <div className="relative bg-white shadow-2xl rounded-xl border-t-4 border-[#1a0a40] overflow-hidden">
              <button 
                onClick={() => setShowPhoneModal(false)}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-900 focus:outline-none p-1"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="p-6 text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 bg-gray-50 text-[#1a0a40]">
                  <Phone className="w-6 h-6" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-gray-900">Contact Téléphonique</h3>
                <p className="mb-6 text-xs text-gray-500 leading-normal">
                  Vous pouvez appeler le vendeur directement sur son numéro de téléphone marocain :
                </p>
                
                <div className="text-xl font-black tracking-wider text-gray-900 mb-6 bg-gray-50 py-3 rounded-lg border border-gray-100 font-mono">
                  {listing.user.profile?.phone || "Numéro non renseigné"}
                </div>
                
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowPhoneModal(false)}
                    className="w-1/2 py-2.5 rounded-lg text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    Fermer
                  </button>
                  {listing.user.profile?.phone ? (
                    <a 
                      href={`tel:${listing.user.profile.phone}`}
                      className="w-1/2 py-2.5 rounded-lg text-xs font-bold text-white hover:opacity-90 flex items-center justify-center gap-1.5 transition-opacity cursor-pointer"
                      style={{ backgroundColor: "#1a0a40" }}
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Appeler
                    </a>
                  ) : (
                    <button 
                      disabled
                      className="w-1/2 py-2.5 rounded-lg text-xs font-bold text-gray-400 bg-gray-100 border border-gray-200 cursor-not-allowed"
                    >
                      Indisponible
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
