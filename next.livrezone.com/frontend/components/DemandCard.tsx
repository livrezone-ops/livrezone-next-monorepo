"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  BookOpen, MapPin, Clock, MessageSquare, 
  Phone, MessageCircle, X, Tag 
} from "lucide-react";
import SmartCoverImage from "@/components/SmartCoverImage";

export interface DemandItem {
  id: number;
  book_id?: number | null;
  title: string;
  author?: string | null;
  isbn?: string | null;
  category_id?: number | null;
  category_name?: string | null;
  cover_url?: string | null;
  cover_thumbnail_url?: string | null;
  cover_thumbnail_url_320?: string | null;
  comment?: string | null;
  status: string;
  published_at?: string | null;
  date_ago?: string | null;
  user: {
    id: number;
    name?: string | null;
    nickname?: string | null;
    city?: {
      id: number;
      name?: string;
      name_fr?: string;
    } | null;
    phone?: string | null;
    has_whatsapp?: boolean;
  };
  language?: {
    id: number;
    name?: string;
    name_fr?: string;
  } | null;
}

interface DemandCardProps {
  demand: DemandItem;
  view?: "grid" | "list";
}

export default function DemandCard({ demand, view = "grid" }: DemandCardProps) {
  const [showPhoneModal, setShowPhoneModal] = useState(false);

  const cover =
    demand.cover_thumbnail_url_320 || demand.cover_thumbnail_url || demand.cover_url || null;

  const rawPhone = demand.user?.phone || "";
  let cleanPhone = rawPhone.replace(/[^0-9]/g, "");
  if (cleanPhone.startsWith("0")) {
    cleanPhone = "212" + cleanPhone.substring(1);
  }
  const isLandline = cleanPhone ? /^(?:05|2125|5\d{8})/.test(cleanPhone) : false;
  const hasWhatsapp = (demand.user?.has_whatsapp ?? true) && !isLandline && Boolean(cleanPhone);

  const whatsappUrl = hasWhatsapp
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Bonjour, j'ai vu votre demande de livre pour « ${demand.title} » sur LivreZone.`)}`
    : null;

  const telLink = rawPhone ? `tel:${rawPhone}` : "#";
  const cityName = demand.user?.city?.name || demand.user?.city?.name_fr;
  const langName = demand.language?.name_fr || demand.language?.name;
  const bookHref = demand.book_id ? `/books/${demand.book_id}` : null;

  const coverContent = cover ? (
    <SmartCoverImage
      src={cover}
      alt={demand.title}
      className="object-cover"
      sizes="(max-width: 640px) 80px, 96px"
      fallbackSrc={demand.cover_url}
    />
  ) : (
    <div className="flex flex-col items-center justify-center text-gray-300 gap-1.5 p-3 text-center h-full">
      <BookOpen className="w-8 h-8 stroke-1" />
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Demande</span>
    </div>
  );

  return (
    <>
      {view === "list" ? (
        /* VUE EN LIGNE (COMPACTE COMME LES ANNONCES) */
        <article className="group bg-white rounded-xl border border-gray-100 hover:border-[#6D28D9]/40 p-3 shadow-xs hover:shadow-md transition-all flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 flex-1 min-w-0">
            {/* Couverture compacte 16x20 (comme ArticleListRow) */}
            {bookHref ? (
              <Link
                href={bookHref}
                className="w-16 h-20 bg-gray-50 rounded-lg shrink-0 border border-gray-150 overflow-hidden relative flex items-center justify-center group-hover:scale-105 transition-transform cursor-pointer"
                title="Consulter la fiche livre dans le catalogue"
              >
                {cover ? (
                  <SmartCoverImage src={cover} alt={demand.title} className="object-cover" sizes="64px" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-300 text-[9px] font-bold">
                    <BookOpen className="w-5 h-5 stroke-1 mb-0.5" />
                    <span>Livre</span>
                  </div>
                )}
              </Link>
            ) : (
              <div className="w-16 h-20 bg-gray-50 rounded-lg shrink-0 border border-gray-150 overflow-hidden relative flex items-center justify-center">
                {cover ? (
                  <SmartCoverImage src={cover} alt={demand.title} className="object-cover" sizes="64px" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-300 text-[9px] font-bold">
                    <BookOpen className="w-5 h-5 stroke-1 mb-0.5" />
                    <span>Livre</span>
                  </div>
                )}
              </div>
            )}

            {/* Informations compactes */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                {bookHref ? (
                  <Link
                    href={bookHref}
                    className="font-bold text-gray-900 text-sm group-hover:text-[#6D28D9] transition-colors truncate max-w-md"
                    title="Consulter la fiche livre dans le catalogue"
                  >
                    {demand.title}
                  </Link>
                ) : (
                  <h3 className="font-bold text-gray-900 text-sm group-hover:text-[#6D28D9] transition-colors truncate max-w-md">
                    {demand.title}
                  </h3>
                )}
              </div>

              {demand.author && (
                <p className="text-xs text-gray-500 truncate mb-1">
                  De : <span className="text-gray-700 font-medium">{demand.author}</span>
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {demand.category_name && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6D28D9] bg-violet-50 px-2 py-0.5 rounded-md">
                    <Tag className="w-3 h-3 text-[#6D28D9] shrink-0" />
                    <span>{demand.category_name}</span>
                  </span>
                )}
                {cityName && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">
                    <MapPin className="w-3 h-3 text-[#F97316] shrink-0" />
                    <span>{cityName}</span>
                  </span>
                )}
                {(demand.isbn || langName) && (
                  <span className="text-[11px] text-gray-400 font-mono hidden md:inline">
                    {demand.isbn && `ISBN: ${demand.isbn}`}
                    {demand.isbn && langName && " · "}
                    {langName && <span className="font-sans text-gray-500">{langName}</span>}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions & Date compacts à droite */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-gray-400 font-medium hidden lg:inline">
              {demand.date_ago || "Récemment"}
            </span>

            <div className="flex items-center gap-1.5">
              {hasWhatsapp && whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center cursor-pointer shadow-2xs"
                  title="Contacter sur WhatsApp"
                >
                  <MessageCircle className="w-4 h-4" />
                </a>
              )}

              {rawPhone && (
                <button
                  type="button"
                  onClick={() => setShowPhoneModal(true)}
                  className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-600 hover:text-white transition-all flex items-center justify-center cursor-pointer shadow-2xs"
                  title="Afficher le numéro de téléphone"
                >
                  <Phone className="w-4 h-4" />
                </button>
              )}

              <Link
                href={`/chat?user=${demand.user.id}`}
                className="h-8 px-3 rounded-lg bg-[#6D28D9] text-white hover:bg-violet-800 transition-all text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                title="Envoyer un message sur LivreZone"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Message</span>
              </Link>
            </div>
          </div>
        </article>
      ) : (
        /* VUE EN GRILLE (COMPACTE OPTIMISÉE POUR 3 CARTES PAR LIGNE) */
        <article className="group bg-white rounded-xl border border-gray-200/90 hover:border-[#6D28D9]/40 p-3.5 sm:p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between h-full">
          <div>
            {/* Top: Couverture + Infos */}
            <div className="flex gap-3 mb-3">
              {/* Couverture compacte */}
              {bookHref ? (
                <Link
                  href={bookHref}
                  className="w-20 sm:w-24 h-28 sm:h-34 bg-gray-50 rounded-lg shrink-0 border border-gray-150 overflow-hidden relative flex items-center justify-center group-hover:scale-[1.02] transition-transform cursor-pointer shadow-2xs"
                  title="Consulter la fiche livre dans le catalogue"
                >
                  {coverContent}
                </Link>
              ) : (
                <div className="w-20 sm:w-24 h-28 sm:h-34 bg-gray-50 rounded-lg shrink-0 border border-gray-150 overflow-hidden relative flex items-center justify-center shadow-2xs">
                  {coverContent}
                </div>
              )}

              {/* Détails */}
              <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                <div>
                  {/* Titre */}
                  {bookHref ? (
                    <Link
                      href={bookHref}
                      className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 hover:text-[#6D28D9] transition-colors block cursor-pointer mb-1"
                      title="Consulter la fiche livre dans le catalogue"
                    >
                      {demand.title}
                    </Link>
                  ) : (
                    <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 group-hover:text-[#6D28D9] transition-colors mb-1">
                      {demand.title}
                    </h3>
                  )}

                  {/* Auteur */}
                  {demand.author && (
                    <p className="text-xs text-gray-600 mb-1 line-clamp-1">
                      De : <span className="font-semibold text-gray-800">{demand.author}</span>
                    </p>
                  )}

                  {/* ISBN & Langue */}
                  {(demand.isbn || langName) && (
                    <div className="flex flex-wrap items-center gap-1 text-[11px] text-gray-500 mb-1">
                      {demand.isbn && (
                        <span className="font-mono text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200 text-[10px]">
                          ISBN: {demand.isbn}
                        </span>
                      )}
                      {demand.isbn && langName && <span className="text-gray-300">·</span>}
                      {langName && (
                        <span className="text-gray-600 font-medium">
                          {langName}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Badges Catégorie & Ville : Alignés tout en bas au niveau du bas de la photo */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {demand.category_name && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6D28D9] bg-violet-50 border border-violet-200/80 px-2 py-0.5 rounded-md">
                      <Tag className="w-3 h-3 text-[#6D28D9] shrink-0" />
                      <span className="truncate max-w-[110px]">{demand.category_name}</span>
                    </span>
                  )}
                  {cityName && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-800 bg-gray-100 border border-gray-250 px-2 py-0.5 rounded-md">
                      <MapPin className="w-3 h-3 text-[#F97316] shrink-0" />
                      <span>{cityName}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Commentaire de l'acheteur si renseigné */}
            {demand.comment && (
              <div className="text-xs text-gray-700 bg-gray-50/90 border border-gray-150 p-2.5 rounded-lg mb-2.5 flex items-start gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                <p className="italic line-clamp-2 leading-relaxed text-gray-600">« {demand.comment} »</p>
              </div>
            )}
          </div>

          {/* Bottom: Date Relative + Boutons d'action */}
          <div className="mt-1 pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 text-[11px] text-gray-400 font-medium">
              <Clock className="w-3 h-3 text-gray-300" />
              <span>{demand.date_ago || "Récemment"}</span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* WhatsApp */}
              {hasWhatsapp && whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center shadow-2xs cursor-pointer"
                  title="Contacter sur WhatsApp"
                >
                  <MessageCircle className="w-4 h-4" />
                </a>
              )}

              {/* Téléphone */}
              {rawPhone && (
                <button
                  type="button"
                  onClick={() => setShowPhoneModal(true)}
                  className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-600 hover:text-white transition-all flex items-center justify-center shadow-2xs cursor-pointer"
                  title="Afficher le numéro de téléphone"
                >
                  <Phone className="w-4 h-4" />
                </button>
              )}

              {/* Message / Chat LivreZone */}
              <Link
                href={`/chat?user=${demand.user.id}`}
                className="h-8 px-2.5 rounded-lg bg-[#6D28D9] text-white hover:bg-violet-800 transition-all text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                title="Envoyer un message sur LivreZone"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Message</span>
              </Link>
            </div>
          </div>
        </article>
      )}

      {/* Phone Call Modal (Identique à ListingDetailsCard & SellerContact) */}
      {showPhoneModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs px-4 animate-in fade-in duration-150"
          onClick={() => setShowPhoneModal(false)}
        >
          <div 
            className="relative w-full max-w-sm bg-white shadow-2xl rounded-xl border-t-4 border-[#1a0a40] overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowPhoneModal(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-900 focus:outline-none p-1 cursor-pointer rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 bg-gray-50 text-[#1a0a40]">
                <Phone className="w-6 h-6" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-gray-900">
                Contact Téléphonique
              </h3>
              <p className="mb-6 text-xs text-gray-500 leading-normal">
                Vous pouvez appeler l’acheteur directement sur son numéro de téléphone marocain :
              </p>

              <div className="text-xl font-black tracking-wider text-gray-900 mb-6 bg-gray-50 py-3 rounded-lg border border-gray-100 font-mono">
                {rawPhone || "Numéro non renseigné"}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPhoneModal(false)}
                  className="w-1/2 py-2.5 rounded-lg text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Fermer
                </button>
                {rawPhone ? (
                  <a
                    href={telLink}
                    className="w-1/2 py-2.5 rounded-lg text-xs font-bold text-white hover:opacity-90 flex items-center justify-center gap-1.5 transition-opacity cursor-pointer shadow-xs"
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
      )}
    </>
  );
}
