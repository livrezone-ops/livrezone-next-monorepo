import { getPublishersPage } from "@/lib/books-api";
import { urlsetXml, xmlResponse } from "@/lib/sitemap-xml";
import { SITE_URL } from "@/lib/site-url";

export const revalidate = 86400;

/**
 * Annuaire des éditeurs (~47k hubs, un seul fichier : sous la limite Google).
 * Slugs calculés côté API (Str::slug) → cohérents avec la page /books/editeurs/{slug}.
 */
export async function GET() {
  const result = await getPublishersPage(1, 50000);
  const urls = (result?.data ?? []).map((publisher) => ({
    loc: `${SITE_URL}/books/editeurs/${publisher.slug}`,
  }));

  return xmlResponse(urlsetXml(urls));
}
