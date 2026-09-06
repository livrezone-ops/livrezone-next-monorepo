import { listingSlug } from "@/lib/book-slug";
import { getSitemapListings, getSitemapListingsMeta } from "@/lib/books-api";
import { urlsetXml, xmlResponse } from "@/lib/sitemap-xml";
import { SITE_URL } from "@/lib/site-url";

export const revalidate = 3600;

/**
 * Annonces publiées : /{nickname}/{id}-{isbn}-{titre} — paginé, prêt pour la
 * croissance (49 annonces aujourd'hui, 5 000/page quand le catalogue grossit).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chunk: string }> },
) {
  const { chunk } = await params;
  const n = parseInt(chunk, 10);

  const meta = await getSitemapListingsMeta();
  if (!meta || n < 1 || n > meta.pages) {
    return new Response("Not found", { status: 404 });
  }

  const listings = await getSitemapListings(n);
  const urls = (listings ?? []).map((listing) => ({
    loc: `${SITE_URL}/${listing.nickname}/${listingSlug(listing)}`,
    lastmod: listing.updated_at,
  }));

  return xmlResponse(urlsetXml(urls));
}
