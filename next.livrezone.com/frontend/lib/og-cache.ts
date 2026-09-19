// Rendu de l'image OG des fiches annonce avec cache 3 niveaux.
// Contexte (retour utilisateur 19/09) : rendre à chaque partage coûte trop de
// CPU (satori + conversion sharp des couvertures webp). Le rendu n'arrive donc
// qu'une fois par VERSION d'annonce : clé disque dérivée de updated_at + prix +
// couverture + TEMPLATE_VERSION. L'URL publique /api/og/listing/<id> est
// versionnée par ETag et servie avec Cache-Control long (CF/navigateurs/FB).
//
// Niveaux : mémoire LRU (50) → disque OG_CACHE_DIR → rendu satori unique.
// Cas dégradés :
// - couverture momentanément indisponible → rendu SANS couverture, mémoire
//   10 min seulement (pas d'écriture disque) : on réessaie la couverture à la
//   prochaine demande au lieu de graver un placeholder pour la vie du fichier.
// - échec satori → servie la dernière image disque de cette annonce (stale),
//   à défaut le PNG de marque statique /og-image.png (route).
// - API indisponible / annonce introuvable → null → la route sert /og-image.png.
// NB : pas de purge automatique disque — ~100 Ko par annonce partagée, monté
// sur volume persistant ; à surveiller avant tout partage massif.
import { createHash } from "node:crypto";
import sharp from "sharp";
import { readFile, readdir, rename, writeFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { getPublicListing, resolveListingCover, type ListingDetail } from "./listings-api";
import { fetchCoverAsDataUri } from "./og-cover";
import { renderCardPNG } from "./og-render";
import { buildCardHtml } from "./og-html";

// v4 (19/09) : carte « visuel-first » — plus aucun texte rasterisé fin
// (titre/ISBN/état passés en og:title/og:description natifs), rendu 2×
// 2400×1260, sortie JPEG.
// v5 (19/09) : retrait des boxShadow — le flou gaussien est rasterisé par
// resvg.wasm et coûtait ~4 s par ombre à 2400×1260 (rendu entier > 10 s).
// v6 (19/09) : moteur de rendu Chromium (Puppeteer) — qualité « outil pro »
// (antialiasing navigateur, vraies ombres) à la place de satori/resvg.
// v7 (19/09) : design « mockup Canva » choisi par le propriétaire — fond
// sombre + glow bleu/violet, titre géant blanc, couverture en perspective 3D.
// v8 (19/09) : refonte netteté Facebook & fidélité maquette — fond clair pastel,
// logo officiel exact, titre géant violet du site, prix très grand (#F97316),
// badges état BookCard (Neuf/Occasion), suppression ISBN, couverture 3D sans mobile.
// v9 (19/09) : sortie pré-réduite 1200×630 (Lanczos3 + sharpen) — Facebook
// affiche la carte à ~500 px ; partis de 2400 px, son scaler réduisait d'un
// facteur 4,8× et détruisait le texte. En livrant 1200 px, la réduction côté
// Facebook tombe à 2,4× et le sharpen pré-compense sa recompression JPEG.
// v10 (19/09 soir) : badge NEUF/OCCASION déplacé de la colonne texte vers un
// ruban incliné 45° posé sur le coin supérieur gauche de la couverture
// (demande propriétaire) — frère de .mockup-card, hors perspective 3D.
export const TEMPLATE_VERSION = "v10";

export const OG_CACHE_DIR =
  process.env.OG_CACHE_DIR || path.join("/tmp", "og-cache");

const MEMORY_MAX = 50;
const TRANSIENT_MEMORY_TTL_MS = 10 * 60 * 1000;

export interface OgRenderResult {
  buffer: Buffer;
  version: string;
  /** true = rendue sans couverture (indisponible), à ne pas graver disque. */
  transient: boolean;
  cache: "memory" | "disk" | "render";
}

interface MemoryEntry {
  buffer: Buffer;
  version: string;
  transient: boolean;
  expiresAt: number; // 0 = jamais
}

const memory = new Map<string, MemoryEntry>();
let diskDisabled = false;

function remember(
  key: string,
  buffer: Buffer,
  version: string,
  transient: boolean,
): void {
  if (memory.size >= MEMORY_MAX) {
    const oldest = memory.keys().next().value;
    if (oldest) memory.delete(oldest);
  }
  memory.set(key, {
    buffer,
    version,
    transient,
    expiresAt: transient ? Date.now() + TRANSIENT_MEMORY_TTL_MS : 0,
  });
}

function rememberFresh(key: string, entry: MemoryEntry): void {
  memory.delete(key);
  memory.set(key, entry);
}

/** Version = empreinte de tout ce qui influence le visuel de la carte. */
function versionOf(listing: ListingDetail): string {
  const cover = resolveListingCover(listing) ?? "";
  return createHash("sha256")
    .update(
      [
        TEMPLATE_VERSION,
        listing.updated_at ?? "",
        String(listing.price),
        listing.discount_price ?? "",
        cover,
        listing.book?.updated_at ?? "",
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 12);
}

function diskPath(key: string, ext: string): string {
  // turbopackIgnore ci-dessous : OG_CACHE_DIR vient de l'env (volume docker),
  // l'analyseur de build ne doit pas tracer tout le projet pour autant.
  return path.join(/*turbopackIgnore: true*/ OG_CACHE_DIR, `${key}.${ext}`);
}

async function writeDisk(key: string, buffer: Buffer): Promise<boolean> {
  if (diskDisabled) return false;
  try {
    await mkdir(/*turbopackIgnore: true*/ OG_CACHE_DIR, { recursive: true });
    const tmp = diskPath(key, `tmp-${process.pid}-${Date.now()}`);
    await writeFile(/*turbopackIgnore: true*/ tmp, buffer);
    await rename(/*turbopackIgnore: true*/ tmp, /*turbopackIgnore: true*/ diskPath(key, "jpg"));
    return true;
  } catch {
    // FS non monté/lecture seule : on continue en mémoire, pas d'erreur fatale.
    diskDisabled = true;
    return false;
  }
}

async function lastStalePng(listingId: number): Promise<Buffer | null> {
  try {
    const prefix = `og-listing-${listingId}-`;
    const candidates = (await readdir(/*turbopackIgnore: true*/ OG_CACHE_DIR))
      .filter((f) => f.startsWith(prefix) && f.endsWith(".jpg"));
    // La plus récemment modifiée, pas la première du tri lexicographique
    // (les hash de version ne se classent pas chronologiquement).
    let newest: { name: string; mtime: number } | null = null;
    for (const f of candidates) {
      const p = path.join(/*turbopackIgnore: true*/ OG_CACHE_DIR, f);
      try {
        const st = await stat(/*turbopackIgnore: true*/ p);
        if (!newest || st.mtimeMs > newest.mtime) newest = { name: f, mtime: st.mtimeMs };
      } catch {
        continue;
      }
    }
    if (newest) {
      const stalePath = path.join(/*turbopackIgnore: true*/ OG_CACHE_DIR, newest.name);
      return await readFile(/*turbopackIgnore: true*/ stalePath);
    }
  } catch {
    // pas de cache disque accessible
  }
  return null;
}

function buildTemplateData(listing: ListingDetail, coverDataUri: string | null) {
  const original = Number(listing.price);
  const discounted = Number(listing.discount_price);
  const hasDiscount =
    listing.discount_price != null &&
    Number.isFinite(discounted) &&
    discounted < original;
  return {
    title: listing.title,
    price: hasDiscount ? discounted : original,
    originalPrice: hasDiscount ? original : null,
    condition: listing.book_condition,
    isbn: listing.book?.isbn_13 || listing.isbn_13 || null,
    coverDataUri,
  };
}

export async function renderListingOG(
  id: string,
): Promise<OgRenderResult | null> {
  const listing = await getPublicListing(id);
  if (!listing) {
    console.error("[og] getPublicListing null pour", id);
    return null;
  }

  const version = versionOf(listing);
  const key = `og-listing-${listing.id}-${version}`;

  // 1. Mémoire (les entrées transientes expirées sont ignorées).
  const mem = memory.get(key);
  if (mem && (mem.expiresAt === 0 || mem.expiresAt > Date.now())) {
    rememberFresh(key, mem);
    return {
      buffer: mem.buffer,
      version: mem.version,
      transient: mem.transient,
      cache: "memory",
    };
  }

  // 2. Disque (seules les rendues avec couverture / sans couverture du tout
  // sont gravées — jamais les transientes).
  try {
    const jpg = await readFile(diskPath(key, "jpg"));
    remember(key, jpg, version, false);
    return { buffer: jpg, version, transient: false, cache: "disk" };
  } catch {
    // miss disque
  }

  // 3. Rendu unique via Chromium (lib/og-render.ts) — HTML embarquant tout
  // en data URI, screenshot 1200×630 @2× → PNG 2400×1260 → JPEG 1200×630.
  const coverUrl = resolveListingCover(listing);
  const coverDataUri = coverUrl ? await fetchCoverAsDataUri(coverUrl) : null;
  const transient = Boolean(coverUrl) && !coverDataUri;

  try {
    const started = Date.now();
    const png = await renderCardPNG(await buildCardHtml(buildTemplateData(listing, coverDataUri)));
    // Sortie 1200×630 (taille recommandée par Facebook, ~2,4× l'affichage
    // réel à ~500 px) : la pré-réduction Lanczos3 maison est bien plus propre
    // que le scaler de Facebook parti de 2400 px, et le sharpen léger
    // pré-compense la recompression JPEG de leur pipeline. Chroma 4:4:4 pour
    // des bords de texte sans compromis. Le vrai sharp est utilisé ici :
    // PNG→JPEG = chargement VipsForeignLoadPng autorisé par le blocklist de
    // Next (seul le chargement SVG y est bloqué).
    const buffer = await sharp(png)
      .resize(1200, 630, { kernel: "lanczos3" })
      .sharpen({ sigma: 0.7 })
      .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
      .toBuffer();
    console.error(`[og] rendu ${id} en ${Date.now() - started}ms`);
    if (transient) {
      remember(key, buffer, version, true);
    } else {
      await writeDisk(key, buffer);
      remember(key, buffer, version, false);
    }
    return { buffer, version, transient, cache: "render" };
  } catch (err) {
    // Rendu impossible : dernière PNG connue de cette annonce, sinon echec.
    console.error(
      "[og] échec rendu satori pour",
      id,
      err,
      "| coverDataUri:",
      coverDataUri ? `${coverDataUri.slice(0, 30)}… (${coverDataUri.length} chars)` : "null",
    );
    const stale = await lastStalePng(listing.id);
    if (stale) {
      return { buffer: stale, version, transient: false, cache: "disk" };
    }
    throw err;
  }
}
