"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { HeroMessage } from "./types";
import SmartCoverImage from "@/components/SmartCoverImage";
import type { HeroListing } from "./LivreZoneHero";

export type LivreZoneHeroMobileProps = {
  messages: HeroMessage[];
  listings?: HeroListing[];
  autoPlayDelay?: number;
};

// Message de secours si aucun message valide
const fallbackMessage: HeroMessage = {
  id: 0,
  language: "fr",
  direction: "ltr",
  title: "Nouveautés & Bonnes affaires",
  description:
    "Les dernières publications proposées par les librairies et les particuliers partout au Maroc.",
  primaryAction: { label: "Découvrir les livres", href: "/annonces" },
  secondaryAction: { label: "Vendre un livre", href: "/annonces/create" },
};

export default function LivreZoneHeroMobile({
  messages,
  listings = [],
  autoPlayDelay = 6000,
}: LivreZoneHeroMobileProps) {
  const slides = useMemo(
    () => (messages.length > 0 ? messages : [fallbackMessage]),
    [messages]
  );

  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  // Utilise les derniers livres publiés et les fait changer harmonieusement avec le carrousel
  const book1Cover = useMemo(() => {
    if (listings.length === 0) return null;
    const idx = (listings.length - 1 - (activeSlide * 2)) % listings.length;
    return listings[(idx + listings.length) % listings.length]?.coverUrl;
  }, [listings, activeSlide]);

  const book2Cover = useMemo(() => {
    if (listings.length === 0) return null;
    const idx = (listings.length - 2 - (activeSlide * 2)) % listings.length;
    return listings[(idx + listings.length) % listings.length]?.coverUrl;
  }, [listings, activeSlide]);

  const goToSlide = useCallback(
    (index: number) => {
      setActiveSlide(((index % slides.length) + slides.length) % slides.length);
    },
    [slides.length]
  );

  const showNextSlide = useCallback(() => {
    setActiveSlide((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const showPreviousSlide = useCallback(() => {
    setActiveSlide((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  // Auto-play
  useEffect(() => {
    if (isPaused || slides.length <= 1) return;
    const interval = window.setInterval(showNextSlide, autoPlayDelay);
    return () => window.clearInterval(interval);
  }, [autoPlayDelay, isPaused, showNextSlide, slides.length]);

  function handleTouchStart(event: React.TouchEvent<HTMLElement>) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLElement>) {
    if (touchStartX.current === null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const distance = touchStartX.current - endX;
    if (Math.abs(distance) >= 40) {
      if (distance > 0) showNextSlide();
      else showPreviousSlide();
    }
    touchStartX.current = null;
  }

  return (
    <section
      className="relative w-full overflow-hidden bg-gradient-to-br from-[#581c87] via-[#6D28D9] to-[#3b0764] text-white pt-8 pb-6 shadow-inner select-none"
      role="region"
      aria-roledescription="carrousel"
      aria-label="Messages LivreZone Mobile"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Halo lumineux décoratif en arrière-plan */}
      <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full bg-violet-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-[#F97316]/20 blur-3xl" />

      {/* Livres inclinés en arrière-plan : Livre 1 en haut, Livre 2 en bas */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-[50%] max-w-[220px] select-none overflow-hidden opacity-35 z-0">
        {/* Livre 1 (en haut à droite, incliné à 16deg) */}
        <div className="absolute -top-3 right-3 w-32 sm:w-40 h-44 sm:h-54 rounded-xl shadow-2xl rotate-[16deg] overflow-hidden border-2 border-white/20 bg-gradient-to-br from-violet-950 to-indigo-950 transition-all duration-700 ease-out">
          {book1Cover ? (
            <SmartCoverImage src={book1Cover} alt="Couverture de livre d'occasion - LivreZone Maroc" className="object-cover" sizes="160px" />
          ) : (
            <div className="w-full h-full flex flex-col justify-between p-3 bg-gradient-to-tr from-violet-950 via-violet-800 to-indigo-900">
              <div className="w-2.5 h-full bg-white/20 absolute left-0 top-0" />
              <div className="text-xs font-bold text-white/50 pl-3">LivreZone</div>
            </div>
          )}
        </div>
        {/* Livre 2 (en bas à droite, incliné à -6deg) */}
        <div className="absolute -bottom-6 right-1 w-32 sm:w-40 h-44 sm:h-54 rounded-xl shadow-2xl -rotate-[6deg] overflow-hidden border-2 border-white/30 bg-gradient-to-br from-orange-900 to-amber-700 transition-all duration-700 ease-out">
          {book2Cover ? (
            <SmartCoverImage src={book2Cover} alt="Couverture de livre neuf - LivreZone Maroc" className="object-cover" sizes="160px" />
          ) : (
            <div className="w-full h-full flex flex-col justify-between p-3 bg-gradient-to-tr from-amber-700 via-orange-600 to-amber-500">
              <div className="w-2.5 h-full bg-white/25 absolute left-0 top-0" />
              <div className="text-xs font-black text-white/70 pl-3">LIVRE</div>
            </div>
          )}
        </div>
      </div>

      {/* Conteneur coulissant des slides (100% de largeur exacte sans fuite) */}
      <div
        className="flex w-full transition-transform duration-500 ease-out relative z-10"
        style={{ transform: `translateX(-${activeSlide * 100}%)` }}
      >
        {slides.map((msg, index) => {
          const isActive = activeSlide === index;

          return (
            <article
              key={msg.id}
              className={`flex-shrink-0 w-full box-border px-6 flex flex-col justify-center ${
                msg.direction === "rtl" ? "font-arabic" : ""
              }`}
              lang={msg.language}
              dir={msg.direction}
              aria-hidden={!isActive}
            >
              {/* Titre (agrandi et aéré pour l'arabe) */}
              <h2
                className={`${
                  msg.direction === "rtl"
                    ? "text-[29px] sm:text-[35px] font-bold leading-[1.3] tracking-normal"
                    : "text-[28px] sm:text-[34px] font-black leading-[1.18] tracking-tight"
                } text-white`}
              >
                {msg.title}
              </h2>

              {/* Description (agrandie et aérée) */}
              <p
                className={`mt-3.5 mb-6 text-lg sm:text-xl text-white/95 ${
                  msg.direction === "rtl" ? "leading-relaxed" : "leading-snug"
                } font-normal`}
              >
                {msg.description}
              </p>

              {/* Boutons d'action (côte à côte, max 1/2 largeur d'écran) */}
              <div className={`flex flex-row items-center gap-3 ${msg.direction === "rtl" ? "justify-end" : "justify-start"}`}>
                <Link
                  href={msg.primaryAction.href}
                  className={`flex-1 max-w-[50%] flex items-center justify-center gap-1.5 bg-[#F97316] hover:bg-[#ea630a] active:scale-[0.98] text-white ${
                    msg.direction === "rtl" ? "text-sm sm:text-base font-bold py-2 px-3" : "text-xs sm:text-sm font-bold py-2.5 px-3.5"
                  } rounded-xl shadow-md transition-all text-center truncate`}
                  tabIndex={isActive ? 0 : -1}
                >
                  <span className="truncate">{msg.primaryAction.label}</span>
                  <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${msg.direction === "rtl" ? "rotate-180" : ""}`} />
                </Link>

                {msg.secondaryAction && (
                  <Link
                    href={msg.secondaryAction.href}
                    className={`flex-1 max-w-[50%] flex items-center justify-center bg-white/15 hover:bg-white/25 active:scale-[0.98] text-white border border-white/25 ${
                      msg.direction === "rtl" ? "text-sm sm:text-base font-semibold py-2 px-3" : "text-xs sm:text-sm font-semibold py-2.5 px-3.5"
                    } rounded-xl backdrop-blur-xs transition-all text-center truncate`}
                    tabIndex={isActive ? 0 : -1}
                  >
                    <span className="truncate">{msg.secondaryAction.label}</span>
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Pagination & Contrôles */}
      {slides.length > 1 && (
        <div className="mt-6 pt-2 px-6 flex items-center justify-between">
          {/* Flèche précédente */}
          <button
            type="button"
            onClick={showPreviousSlide}
            aria-label="Message précédent"
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 active:scale-95 border border-white/10 flex items-center justify-center text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Indicateurs / Dots */}
          <div className="flex items-center gap-1.5" aria-label="Pagination carrousel">
            {slides.map((msg, index) => (
              <button
                key={msg.id}
                type="button"
                onClick={() => goToSlide(index)}
                aria-label={`Aller au message ${index + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                  activeSlide === index
                    ? "w-6 bg-white shadow-xs"
                    : "w-2 bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>

          {/* Flèche suivante */}
          <button
            type="button"
            onClick={showNextSlide}
            aria-label="Message suivant"
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 active:scale-95 border border-white/10 flex items-center justify-center text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </section>
  );
}
