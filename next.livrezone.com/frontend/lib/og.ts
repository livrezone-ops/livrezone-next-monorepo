// Centralise les métadonnées OpenGraph partagées (quick win SEO 06/09).
// Dans Next App Router, un openGraph défini au niveau page REMPLACE celui du
// layout : sans images explicites, og:image disparaissait des pages qui
// redéfinissaient openGraph — et /og-image.png n'existait pas dans public/
// avant le 06/09 (référence cassée site-wide depuis l'origine).
import { SITE_URL } from "@/lib/site-url";

export const OG_IMAGE_PATH = "/og-image.png";

export function ogImage() {
  return {
    url: OG_IMAGE_PATH,
    width: 1200,
    height: 630,
    alt: "LivreZone — Marketplace de livres neufs et d'occasion au Maroc",
  };
}

/** Champs OpenGraph communs à toutes les pages : à spreaeder dans openGraph. */
export function ogDefaults() {
  return {
    siteName: "LivreZone",
    locale: "fr_MA",
    images: [ogImage()],
  };
}

/** URL absolue de l'image OG (usage non-metadata : JSON-LD, robots, etc.). */
export function ogImageUrl(): string {
  return `${SITE_URL}${OG_IMAGE_PATH}`;
}
