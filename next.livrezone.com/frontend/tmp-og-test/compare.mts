// Banc d'essai v8 vs v9 : rend la carte de l'annonce 118 (Kid's Box 5) via
// Chromium, puis compare les deux chaînes de sortie au juge de vérité —
// la simulation du fil Facebook (réduction 480 px + JPEG q80).
import { buildCardHtml } from "./og-html.ts";
import { renderCardPNG } from "./og-render.ts";
import sharp from "sharp";

// Sorties : /tmp/og-out (inscriptible par l'utilisateur node du conteneur).
const OUT = "/tmp/og-out";

const COVER_URL =
  "https://api-next.livrezone.com/book-cover-proxy/9781316628782.webp";

async function coverDataUri(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`cover ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  let mime = "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50) mime = "image/png";
  else if (buf.subarray(8, 12).toString("latin1") === "WEBP") mime = "image/webp";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

const data = {
  title: "Kid's Box 5 Activity Book+Online Resources (Updated 2nd Ed)",
  price: 80,
  originalPrice: 125,
  condition: "occas",
  isbn: "9781316628782",
  coverDataUri: await coverDataUri(COVER_URL),
};

const png = await renderCardPNG(await buildCardHtml(data as any));
console.log(`PNG ${png.length} bytes`);

// v8 (déployé) : JPEG 2400×1260 direct — Facebook réduit de 4,8×.
const v8 = await sharp(png)
  .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
  .toBuffer();
// v9 : pré-réduction Lanczos3 1200×630 + sharpen, Facebook réduit de 2,4×.
const v9 = await sharp(png)
  .resize(1200, 630, { kernel: "lanczos3" })
  .sharpen({ sigma: 0.7 })
  .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
  .toBuffer();
// variante sharpen plus marqué, pour choisir à l'œil.
const v9b = await sharp(png)
  .resize(1200, 630, { kernel: "lanczos3" })
  .sharpen({ sigma: 1.0 })
  .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
  .toBuffer();

for (const [name, buf] of [
  ["v8", v8],
  ["v9", v9],
  ["v9b", v9b],
] as const) {
  await sharp(buf).toFile(`${OUT}/${name}-full.jpg`);
  await sharp(buf).resize({ width: 480 }).jpeg({ quality: 80 }).toFile(`${OUT}/${name}-fb.jpg`);
  console.log(`${name}: ${buf.length} bytes`);
}

// Planche comparative : v8 / v9 / v9b empilés, agrandis 2× (nearest) pour
// inspection à l'œil nu des artefacts. (480 px sim d'une 1200×630 = 252 px)
const GAP = 6;
const TILE_H = 504; // 252 × 2
const tiles: Array<{ input: Buffer; left: number; top: number }> = [];
for (const [i, name] of ["v8", "v9", "v9b"].entries()) {
  const up = await sharp(`${OUT}/${name}-fb.jpg`)
    .resize({ width: 960, kernel: "nearest" })
    .png()
    .toBuffer();
  tiles.push({ input: up, left: 0, top: i * (TILE_H + GAP) });
}
await sharp({
  create: {
    width: 960,
    height: 3 * TILE_H + 2 * GAP,
    channels: 3,
    background: { r: 40, g: 40, b: 40 },
  },
})
  .composite(tiles)
  .png()
  .toFile(`${OUT}/compare-2x.png`);
console.log("planche compare-2x.png écrite");

// Le navigateur singleton garde l'event loop vivant : sortie explicite.
process.exit(0);
