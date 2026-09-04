"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/** L'optimiseur next/image ne sait servir que les hôtes de remotePatterns. */
function isOptimizableCover(url: string): boolean {
  return (
    url.startsWith("/") ||
    url.startsWith("https://api-next.livrezone.com") ||
    url.startsWith("http://localhost")
  );
}

interface SmartCoverImageProps {
  /** URL principale (idéalement une miniature API) */
  src: string | null | undefined;
  alt: string;
  /** Classes d'object-fit (le positionnement absolu est géré par `fill`) */
  className?: string;
  /** Tailles responsives pour l'optimiseur (défaut : vignettes ~96px) */
  sizes?: string;
  /** Appelé quand toutes les sources ont échoué (fallback icône parent) */
  onError?: () => void;
  /** URL de secours (ex. cover_url) essayée en <img> natif si `src` échoue */
  fallbackSrc?: string | null;
  priority?: boolean;
}

/**
 * Couverture/photo unifiée : passe par l'optimiseur next/image (webp, cache
 * 30 j, ruleEngine WAF désactivé sur /_next/image) quand l'hôte est autorisé,
 * sinon <img> natif différé (URLs externes, blob d'aperçu d'upload…).
 * Rendu en `fill` → le parent DOIT être positionné (relative/absolute).
 * Rend `null` si aucune source utilisable — le parent garde son fallback icône.
 */
export default function SmartCoverImage({
  src,
  alt,
  className,
  sizes = "96px",
  onError,
  fallbackSrc,
  priority,
}: SmartCoverImageProps) {
  // État = URL échouée (et non un booléen) → reset naturel quand `src` change,
  // sans setState dans un effet.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [failedFallbackUrl, setFailedFallbackUrl] = useState<string | null>(null);

  const failed = src != null && failedUrl === src;
  const fallbackFailed =
    fallbackSrc != null && failedFallbackUrl === fallbackSrc;

  // Toutes les sources ont échoué → prévenir le parent (fallback icône).
  useEffect(() => {
    if (failed && (!fallbackSrc || fallbackFailed || fallbackSrc === src)) {
      onError?.();
    }
  }, [failed, fallbackFailed, fallbackSrc, src, onError]);

  if (!src) return null;

  if (failed) {
    if (fallbackSrc && fallbackSrc !== src && !fallbackFailed) {
      return (
        <img
          src={fallbackSrc}
          alt={alt}
          className={className}
          loading="lazy"
          onError={() => setFailedFallbackUrl(fallbackSrc)}
        />
      );
    }
    return null;
  }

  if (!isOptimizableCover(src)) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading="lazy"
        onError={() => setFailedUrl(src)}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      onError={() => setFailedUrl(src)}
      priority={priority}
    />
  );
}
