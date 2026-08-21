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
import { useToast } from "@/components/Toast";

interface Listing {
  id: number;
  title: string;
  description: string;
  book_condition: string;
  price: number;
  discount_price?: number | null;
  published_ago?: string | null;
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

  const { success } = useToast();
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
      success("Lien copié dans le presse-papiers !");
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
          <div className="relative w-full pb-[135%] bg-gradient-to-b from-slate-50/70 to-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden group">
            {/* Condition Diagonal Corner Ribbon (45°) */}
            {listing.book_condition === "neuf" && (
              <div className="absolute -left-14 top-7 z-10 w-48 -rotate-45 bg-emerald-600 py-2 text-center text-xs sm:text-[13px] font-black uppercase tracking-widest text-white shadow-md select-none pointer-events-none">
                Neuf
              </div>
            )}
            {listing.book_condition === "occas" && (
              <div className="absolute -left-14 top-7 z-10 w-48 -rotate-45 bg-[#6D28D9] py-2 text-center text-xs sm:text-[13px] font-black uppercase tracking-widest text-white shadow-md select-none pointer-events-none">
                Occasion
              </div>
            )}

            {coverUrl ? (
              <Image 
                src={coverUrl} 
                alt={`Couverture du livre ${listing.title} - LivreZone Maroc`} 
                fill
                className="object-contain p-6 sm:p-8 transition-transform duration-500 ease-out group-hover:scale-105"
                unoptimized
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 text-slate-400">
                <BookOpen className="h-16 w-16 mb-2 stroke-1 text-slate-300" />
                <span className="text-xs font-semibold text-slate-400">Couverture indisponible</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Listing Metadata */}
        <div className="w-full md:w-7/12 flex flex-col">
          {/* Title */}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-950 tracking-tight leading-[1.2] mb-3">
            {listing.title}
          </h1>

          {/* Author & ISBN Specs */}
          <div className="flex flex-wrap items-center gap-y-1.5 gap-x-3 text-xs sm:text-sm text-gray-600 mb-4 pb-4 border-b border-gray-100">
            {authors && (
              <div>
                Par <span className="font-bold text-gray-900">{authors}</span>
              </div>
            )}
            {authors && listing.book?.isbn_13 && (
              <span className="text-gray-300">•</span>
            )}
            {listing.book?.isbn_13 && (
              <div className="text-gray-500">
                ISBN : <span className="font-mono font-bold text-gray-800">{listing.book.isbn_13}</span>
              </div>
            )}
          </div>

          {/* Price Box */}
          <div className="my-2 p-5 rounded-2xl bg-gradient-to-br from-slate-50 via-white to-violet-50/30 border border-slate-200/80 shadow-xs">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black text-gray-950 tracking-tight">
                  {price}
                </span>
                <span className="text-lg font-bold text-gray-600">MAD</span>
                {isDiscounted && (
                  <>
                    <span className="text-base text-gray-400 line-through font-medium ml-1">
                      {listing.price} MAD
                    </span>
                    <span className="ml-1 bg-emerald-100 text-emerald-800 text-xs font-black px-2.5 py-0.5 rounded-full uppercase">
                      -{discountPct}%
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/80 text-xs font-bold uppercase tracking-wider">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Disponible</span>
              </div>
            </div>

            <div className="mt-3.5 pt-3.5 border-t border-slate-200/60 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-medium">État du livre :</span>
                {listing.book_condition === "neuf" ? (
                  <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full">Neuf</span>
                ) : (
                  <span className="font-bold text-violet-700 bg-violet-50 border border-violet-200/80 px-2.5 py-0.5 rounded-full">Occasion</span>
                )}
              </div>
              {listing.published_ago && (
                <span className="text-gray-400">
                  Publié {listing.published_ago}
                </span>
              )}
            </div>
          </div>

          {/* Delivery & Location Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="w-10 h-10 rounded-lg bg-violet-100/80 text-[#6D28D9] flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Livraison</div>
                <div className="text-xs sm:text-sm font-bold text-gray-900">Partout au Maroc</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="w-10 h-10 rounded-lg bg-amber-100/80 text-[#F97316] flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Ville du vendeur</div>
                <div className="text-xs sm:text-sm font-bold text-gray-900">{listing.user.profile?.city?.name || "Maroc"}</div>
              </div>
            </div>
          </div>

          {/* Actions (Favoris / Panier / Partager) toujours sur la même ligne */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 my-3 text-xs font-bold w-full">
            <button
              onClick={handleToggleFav}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border transition-all cursor-pointer truncate ${
                isFav 
                  ? "bg-red-50 border-red-200 text-red-600 shadow-xs" 
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
              }`}
              aria-pressed={isFav}
              title={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
            >
              <Heart className={`w-4 h-4 shrink-0 ${isFav ? "fill-red-500 text-red-500" : ""}`} />
              <span className="truncate">Favoris</span>
            </button>

            {isInCartBool ? (
              <span 
                className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold truncate"
                title="Déjà dans votre panier"
              >
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span className="truncate">Au panier</span>
              </span>
            ) : (
              <button
                onClick={handleAddToCart}
                className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-[#F97316]/5 hover:border-[#F97316] hover:text-[#F97316] transition-all cursor-pointer truncate"
                title="Ajouter ce livre à votre panier"
              >
                <ShoppingCart className="w-4 h-4 shrink-0" />
                <span className="truncate">Panier</span>
              </button>
            )}
            
            <div className="relative w-full">
              <button 
                onClick={() => setShareOpen(!shareOpen)}
                className="flex items-center justify-center gap-1.5 w-full py-2.5 px-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all cursor-pointer focus:outline-none truncate"
                title="Partager cette annonce"
              >
                <Share2 className="w-4 h-4 shrink-0" />
                <span className="truncate">Partager</span>
              </button>
              {shareOpen && (
                <div className="absolute right-0 sm:left-0 top-full mt-2 w-48 bg-white border border-gray-100 shadow-xl rounded-xl z-20 py-1.5 text-xs text-black animate-in fade-in slide-in-from-top-2 duration-150">
                  <button 
                    onClick={handleFacebookShare}
                    className="flex w-full text-left px-4 py-2.5 hover:bg-gray-50 text-[#1877F2] font-semibold items-center gap-2 cursor-pointer"
                  >
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z"/></svg> Facebook
                  </button>
                  <button 
                    onClick={handleWhatsAppShare}
                    className="flex w-full text-left px-4 py-2.5 hover:bg-gray-50 text-[#25D366] font-semibold items-center gap-2 cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" /> WhatsApp
                  </button>
                  <button 
                    onClick={handleCopyLink}
                    className="flex w-full text-left px-4 py-2.5 hover:bg-gray-50 text-gray-700 font-semibold items-center gap-2 border-t border-gray-50 mt-1 pt-2 cursor-pointer"
                  >
                    <Copy className="w-4 h-4" /> Copier le lien
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Seller / Contact Card */}
          <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-slate-50 via-white to-slate-50 border border-slate-200/90 shadow-sm mt-4">
            {/* Seller Header */}
            <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-full bg-[#1a0a40] text-white flex items-center justify-center font-black text-lg shadow-xs shrink-0 uppercase">
                  {(listing.user.profile?.nickname || listing.user.name).charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Vendeur</div>
                  <Link 
                    href={sellerPath} 
                    className="text-base sm:text-lg font-black text-gray-900 hover:text-[#6D28D9] transition-colors truncate block"
                  >
                    {listing.user.profile?.nickname || listing.user.name}
                  </Link>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-lg flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span className="font-bold text-gray-900 text-xs leading-none">
                    {listing.user.profile?.rating_count && listing.user.profile.rating_count > 0
                      ? Number(listing.user.profile.rating_average ?? 0).toFixed(1)
                      : "Nouveau"}
                  </span>
                  {listing.user.profile?.rating_count && listing.user.profile.rating_count > 0 && (
                    <span className="text-gray-400 text-[10px] font-medium">
                      ({listing.user.profile.rating_count})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Actions */}
            <div className="space-y-2.5">
              {/* WhatsApp Primary Button */}
              <a 
                href={cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent("Bonjour, je suis intéressé par votre annonce sur LivreZone : " + listing.title)}%0A${encodeURIComponent(shareUrl)}` : "#"} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full h-12 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-sm font-bold shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-[0.99]"
              >
                <MessageCircle className="w-5 h-5 fill-current" />
                <span>Contacter sur WhatsApp</span>
              </a>

              {/* Phone & Chat Secondary Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <button 
                  onClick={() => setShowPhoneModal(true)}
                  className="h-11 rounded-xl bg-white border border-gray-300 text-gray-800 hover:bg-gray-50 hover:border-gray-400 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                >
                  <Phone className="w-4 h-4 text-gray-600" />
                  <span>Téléphone</span>
                </button>

                <Link 
                  href={`/chat?user=${listing.user.id}`}
                  className="h-11 rounded-xl bg-white border border-gray-300 text-gray-800 hover:bg-gray-50 hover:border-gray-400 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                >
                  <MessageSquare className="w-4 h-4 text-gray-600" />
                  <span>Message</span>
                </Link>
              </div>

              {/* Visit Shop Link */}
              <Link
                href={sellerPath}
                className="mt-3 flex items-center justify-center w-full py-2.5 text-xs font-bold text-[#6D28D9] hover:text-violet-900 transition-colors"
              >
                <Store className="w-4 h-4 mr-1.5" />
                <span>Voir toutes les annonces de ce vendeur &rarr;</span>
              </Link>
            </div>
          </div>

        </div>
      </div>

      {/* Tabs Panel */}
      <div className="border-t border-gray-200 pt-2 mt-12">
        <div className="flex border-b border-gray-100 gap-2">
          <button 
            onClick={() => setActiveTab("description")}
            className={`px-6 py-3.5 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "description" 
                ? "border-[#6D28D9] text-[#6D28D9]" 
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            Description
          </button>
          <button 
            onClick={() => setActiveTab("details")}
            className={`px-6 py-3.5 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "details" 
                ? "border-[#6D28D9] text-[#6D28D9]" 
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            Caractéristiques du livre
          </button>
        </div>

        <div className="py-8">
          {activeTab === "description" ? (
            <div className="text-sm text-gray-700 leading-relaxed max-w-4xl whitespace-pre-line bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
              {listing.description || <p className="italic text-gray-400">Aucune description fournie par le vendeur.</p>}
            </div>
          ) : (
            <div className="max-w-xl bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
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
