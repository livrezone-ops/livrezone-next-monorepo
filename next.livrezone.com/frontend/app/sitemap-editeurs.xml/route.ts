import { getPublishersAll } from "@/lib/books-api";
import { urlsetXml, xmlResponse } from "@/lib/sitemap-xml";
import { SITE_URL } from "@/lib/site-url";

export const revalidate = 86400;

/**
 * Annuaire des éditeurs (~47k hubs, un seul fichier : sous la limite Google).
 * Slugs calculés côté API (Str::slug) → cohérents avec la page /books/editeurs/{slug}.
 * Récupération paginée (lots de 10 000) : un appel unique per_page=50000 (~6.8 Mo)
 * dépasse la limite du data cache Next.js (2 Mo) et faisait échouer le build (08/09).
 */
export async function GET() {
  const publishers = await getPublishersAll();
  const urls = publishers.map((publisher) => ({
    loc: `${SITE_URL}/books/editeurs/${publisher.slug}`,
  }));

  return xmlResponse(urlsetXml(urls));
}
