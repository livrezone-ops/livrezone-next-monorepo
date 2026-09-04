import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/lib/reference-data";

const SITE_URL = "https://next.livrezone.com";

// Sitemap volontairement allégé (décision propriétaire 03/09) : aucun appel
// API. L'ancienne version embarquait toutes les annonces publiées (~700k
// URLs) — trop lourd à générer (page lente/timeout) et au-delà de la limite
// Google de 50 000 URLs par fichier. Les fiches annonces sont découvertes par
// exploration des liens depuis /annonces, /books et les pages rayons.
// Si besoin plus tard : sitemap index + chunks paginés (session dédiée).
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/annonces`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/books`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/books/auteurs`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    },
  ];

  // Pages rayons (familles + sous-catégories) du catalogue livres.
  const themeRoutes: MetadataRoute.Sitemap = CATEGORIES.flatMap((family) => [
    { code: family.code },
    ...(family.children || []).map((child) => ({ code: child.code })),
  ]).map(({ code }) => ({
    url: `${SITE_URL}/books/themes/${code}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...routes, ...themeRoutes];
}