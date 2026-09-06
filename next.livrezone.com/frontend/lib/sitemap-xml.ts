// Helpers XML pour les sitemaps splittés (SEO catalogue, 06/09).
// Limites Google : 50 000 URLs / 50 Mo par fichier — les chunks livres sont
// servis à 50 000 exactement.

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function urlsetXml(urls: { loc: string; lastmod?: string | null }[]): string {
  const now = new Date().toISOString();
  const body = urls
    .map(
      (u) =>
        `<url><loc>${esc(u.loc)}</loc><lastmod>${u.lastmod || now}</lastmod></url>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

export function sitemapIndexXml(entries: { loc: string; lastmod?: string }[]): string {
  const body = entries
    .map(
      (e) =>
        `<sitemap><loc>${esc(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}</sitemap>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`;
}

export function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
