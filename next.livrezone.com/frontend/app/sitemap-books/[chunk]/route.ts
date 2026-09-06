import { bookSlug } from "@/lib/book-slug";
import { getSitemapBooks, getSitemapBooksMeta } from "@/lib/books-api";
import { urlsetXml, xmlResponse } from "@/lib/sitemap-xml";
import { SITE_URL } from "@/lib/site-url";

export const revalidate = 86400;

/**
 * Chunk livres : 50 000 fiches par fichier (limite Google), bornes servies par
 * /api/sitemap/books/meta (cache 24 h) — /sitemap-books/1.xml, 2.xml, …
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chunk: string }> },
) {
  const { chunk } = await params;
  const n = parseInt(chunk, 10);

  const meta = await getSitemapBooksMeta();
  const bounds = meta?.chunks?.[n - 1];
  if (!meta || !bounds) {
    return new Response("Not found", { status: 404 });
  }

  const books = await getSitemapBooks(bounds.min_id, bounds.max_id);
  const urls = (books ?? []).map((book) => ({
    loc: `${SITE_URL}/books/${bookSlug(book)}`,
    lastmod: book.updated_at,
  }));

  return xmlResponse(urlsetXml(urls));
}
