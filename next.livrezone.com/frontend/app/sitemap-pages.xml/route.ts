import { CATEGORIES } from "@/lib/reference-data";
import { urlsetXml, xmlResponse } from "@/lib/sitemap-xml";
import { SITE_URL } from "@/lib/site-url";

export const revalidate = 86400;

/**
 * Pages statiques + rayons (ex-app/sitemap.ts, volontairement allégé selon la
 * décision propriétaire du 03/09 : aucun appel API sur ce fichier).
 */
export function GET() {
  const routes: { loc: string; priority: number; changeFrequency: string }[] = [
    { loc: SITE_URL, priority: 1, changeFrequency: "daily" },
    { loc: `${SITE_URL}/annonces`, priority: 0.9, changeFrequency: "hourly" },
    { loc: `${SITE_URL}/books`, priority: 0.6, changeFrequency: "weekly" },
  ];

  const themeCodes = CATEGORIES.flatMap((family) => [
    family.code,
    ...(family.children || []).map((child) => child.code),
  ]).map((code) => ({
    loc: `${SITE_URL}/books/themes/${code}`,
    priority: 0.5,
    changeFrequency: "weekly",
  }));

  return xmlResponse(
    urlsetXml([...routes, ...themeCodes].map((r) => ({ loc: r.loc }))),
  );
}
