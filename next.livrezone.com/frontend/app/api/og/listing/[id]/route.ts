// Image OpenGraph des fiches annonce : /api/og/listing/<id>
// URL référencée dans generateMetadata de app/[nickname]/[slug]/page.tsx.
// Rendu mis en cache (mémoire + disque, cf. lib/og-cache.ts) — le rendu
// satori n'arrive qu'une fois par version d'annonce. Réponse immuable :
// le contenu change seulement quand l'ETag (version) change.
// Dernier recours absolu : le PNG de marque statique /og-image.png — un
// scraper (Facebook) ne doit JAMAIS recevoir de 5xx.
// Sortie : JPEG 1200×630 pré-réduit + sharpen (cf. lib/og-cache.ts, v9).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { renderListingOG } from "@/lib/og-cache";

export const dynamic = "force-dynamic";

const LONG_CACHE =
  "public, max-age=86400, stale-while-revalidate=604800, immutable";

const JPEG_HEADERS = {
  "Content-Type": "image/jpeg",
  "Cache-Control": LONG_CACHE,
};

async function staticBrandImage(): Promise<NextResponse | null> {
  try {
    const png = await readFile(path.join(process.cwd(), "public", "og-image.png"));
    return new NextResponse(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": LONG_CACHE },
    });
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^\d{1,10}$/.test(id)) {
    return new NextResponse("Not found", { status: 404 });
  }

  let etag = "";
  try {
    const result = await renderListingOG(id);
    if (!result) {
      const brand = await staticBrandImage();
      if (brand) return brand;
      return new NextResponse("Not found", { status: 404 });
    }

    etag = `"og-${id}-${result.version}"`;
    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: etag, "Cache-Control": LONG_CACHE },
      });
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        ...JPEG_HEADERS,
        "Content-Length": String(result.buffer.byteLength),
        ETag: etag,
      },
    });
  } catch (err) {
    console.error("[og] erreur route pour", id, err);
    const brand = await staticBrandImage();
    if (brand) return brand;
    return new NextResponse("Internal error", { status: 500 });
  }
}
