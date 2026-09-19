// Rendu unique v10 (ruban état 45°) pour contrôle visuel du placement.
import { buildCardHtml } from "./og-html.ts";
import { renderCardPNG } from "./og-render.ts";
import sharp from "sharp";

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

const png = await renderCardPNG(
  await buildCardHtml({
    title: "Kid's Box 5 Activity Book+Online Resources (Updated 2nd Ed)",
    price: 80,
    originalPrice: 125,
    condition: "occas",
    isbn: "9781316628782",
    coverDataUri: await coverDataUri(COVER_URL),
  } as any),
);

const v10 = await sharp(png)
  .resize(1200, 630, { kernel: "lanczos3" })
  .sharpen({ sigma: 0.7 })
  .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
  .toBuffer();
await sharp(v10).toFile(`${OUT}/v10-full.jpg`);
await sharp(v10).resize({ width: 480 }).jpeg({ quality: 80 }).toFile(`${OUT}/v10-fb.jpg`);
console.log(`v10: ${v10.length} bytes`);

// Le navigateur singleton garde l'event loop vivant : sortie explicite.
process.exit(0);
