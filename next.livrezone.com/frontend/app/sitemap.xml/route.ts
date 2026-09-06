import { getSitemapBooksMeta, getSitemapListingsMeta } from "@/lib/books-api";
import { sitemapIndexXml, xmlResponse } from "@/lib/sitemap-xml";
import { SITE_URL } from "@/lib/site-url";

export const revalidate = 86400;

/**
 * Sitemap index (SEO catalogue, 06/09) : /sitemap.xml liste désormais les
 * sitemaps splittés — pages/rayons, chunks livres (~14 × 50k URLs), annonces,
 * éditeurs. robots.txt continue de pointer ici : aucune resoumission GSC.
 */
export async function GET() {
  const [books, listings] = await Promise.all([
    getSitemapBooksMeta(),
    getSitemapListingsMeta(),
  ]);

  const now = new Date().toISOString();
  const entries: { loc: string; lastmod: string }[] = [
    { loc: `${SITE_URL}/sitemap-pages.xml`, lastmod: now },
  ];

  const bookChunks = books?.chunks?.length ?? 0;
  for (let i = 1; i <= bookChunks; i++) {
    entries.push({ loc: `${SITE_URL}/sitemap-books/${i}.xml`, lastmod: now });
  }

  const listingPages = listings?.pages ?? 1;
  for (let i = 1; i <= listingPages; i++) {
    entries.push({ loc: `${SITE_URL}/sitemap-listings/${i}.xml`, lastmod: now });
  }

  entries.push({ loc: `${SITE_URL}/sitemap-editeurs.xml`, lastmod: now });

  return xmlResponse(sitemapIndexXml(entries));
}
