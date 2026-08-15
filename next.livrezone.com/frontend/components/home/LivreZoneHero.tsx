"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import type { HeroMessage } from "./types";
import styles from "./LivreZoneHero.module.css";

export type HeroListing = {
  id: number;
  title: string;
  coverUrl: string | null;
  href: string;
};

type LivreZoneHeroProps = {
  messages: HeroMessage[];
  listings: HeroListing[];
  autoPlayDelay?: number;
};

// Message de secours si aucun message valide
const fallbackMessage: HeroMessage = {
  id: 0,
  language: "fr",
  direction: "ltr",
  title: "Nouveautés",
  description:
    "Les dernières publications proposées par les librairies et les particuliers partout au Maroc.",
  primaryAction: { label: "Découvrir les livres", href: "/annonces" },
};

export default function LivreZoneHero({
  messages,
  listings,
  autoPlayDelay = 7000,
}: LivreZoneHeroProps) {
  const slides = useMemo(
    () => (messages.length > 0 ? messages : [fallbackMessage]),
    [messages],
  );

  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  // Chaque slide utilise un offset différent pour les couvertures
  const visibleBooks = useMemo(() => {
    return slides.map((_, slideIndex) => {
      if (listings.length === 0) return [];
      const offset = (slideIndex * 7) % listings.length;
      return [...listings.slice(offset), ...listings.slice(0, offset)].slice(
        0,
        15,
      );
    });
  }, [listings, slides]);

  const goToSlide = useCallback((index: number) => {
    setActiveSlide(((index % slides.length) + slides.length) % slides.length);
  }, [slides.length]);

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
    if (Math.abs(distance) >= 45) {
      if (distance > 0) showNextSlide();
      else showPreviousSlide();
    }
    touchStartX.current = null;
  }

  return (
    <section
      className={styles.hero}
      role="region"
      aria-roledescription="carrousel"
      aria-label="Messages LivreZone"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Track des slides */}
      <div
        className={styles.track}
        style={{ transform: `translateX(-${activeSlide * 100}%)` }}
      >
        {slides.map((msg, slideIndex) => {
          const books = visibleBooks[slideIndex];
          // 5 colonnes pour le mur
          const columns: HeroListing[][] = Array.from({ length: 5 }, () => []);
          books.forEach((book, i) => columns[i % 5].push(book));

          const isActive = activeSlide === slideIndex;

          return (
            <article
              key={msg.id}
              className={styles.slide}
              lang={msg.language}
              dir={msg.direction}
              aria-hidden={!isActive}
            >
              {/* Zone gauche */}
              <div className={styles.content}>
                <h2 className={styles.title}>{msg.title}</h2>
                <p className={styles.description}>{msg.description}</p>
                <div className={styles.actions}>
                  <Link
                    href={msg.primaryAction.href}
                    className={styles.primaryButton}
                    tabIndex={isActive ? 0 : -1}
                  >
                    {msg.primaryAction.label}
                  </Link>
                  {msg.secondaryAction && (
                    <Link
                      href={msg.secondaryAction.href}
                      className={styles.secondaryButton}
                      tabIndex={isActive ? 0 : -1}
                    >
                      {msg.secondaryAction.label}
                    </Link>
                  )}
                </div>
              </div>

              {/* Zone droite : mur de couvertures */}
              {books.length > 0 ? (
                <div className={styles.wall} aria-label="Sélection de livres">
                  {columns.map((col, colIndex) => (
                    <div
                      key={colIndex}
                      className={styles.bookColumn}
                      data-direction={colIndex % 2 === 0 ? "up" : "down"}
                    >
                      {col.map((book, bookIndex) => (
                        <Link
                          key={book.id}
                          href={book.href}
                          className={styles.book}
                          aria-label={`Voir l'annonce : ${book.title}`}
                          tabIndex={isActive ? 0 : -1}
                          style={
                            {
                              "--book-offset":
                                `${(bookIndex % 3) * 14}px`,
                            } as React.CSSProperties
                          }
                        >
                          {book.coverUrl ? (
                            <img
                              src={book.coverUrl}
                              alt={`Couverture de ${book.title}`}
                              className={styles.cover}
                              loading={
                                isActive && slideIndex <= 1
                                  ? "eager"
                                  : "lazy"
                              }
                            />
                          ) : (
                            <span
                              className={styles.coverPlaceholder}
                              aria-hidden="true"
                            />
                          )}
                          <span className={styles.bookTitle}>
                            {book.title}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyWall}>
                  <span>Les prochaines découvertes arrivent bientôt.</span>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Navigation */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            className={`${styles.arrow} ${styles.previousArrow}`}
            onClick={showPreviousSlide}
            aria-label="Afficher le message précédent"
          >
            <span aria-hidden="true">‹</span>
          </button>

          <button
            type="button"
            className={`${styles.arrow} ${styles.nextArrow}`}
            onClick={showNextSlide}
            aria-label="Afficher le message suivant"
          >
            <span aria-hidden="true">›</span>
          </button>

          <div className={styles.pagination} aria-label="Choisir un message">
            {slides.map((msg, index) => (
              <button
                key={msg.id}
                type="button"
                className={`${styles.dot}${activeSlide === index ? ` ${styles.activeDot}` : ""}`}
                onClick={() => goToSlide(index)}
                aria-label={`Afficher le message ${index + 1}`}
                aria-current={activeSlide === index ? "true" : undefined}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}