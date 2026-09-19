// Récupération d'une couverture → data URI brute pour le rendu Chromium
// (lib/og-render.ts). Depuis la bascule vers le navigateur, AUCUNE conversion
// sharp : Chrome décode nativement webp/jpeg/png, et le resampling final est
// fait par le moteur (meilleure qualité qu'une double passe sharp + navigateur).
// Retourne null en cas d'échec → la template affiche son placeholder.
const MAX_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 5000;

// Le content-type d'une réponse peut mentir (page d'erreur servie en image/*)
// : on vérifie la signature réelle du buffer avant de l'embarquer.
function sniffImageMime(buffer: Buffer): string | null {
  if (buffer.length > 12 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length > 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export async function fetchCoverAsDataUri(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "image/webp,image/jpeg,image/png,image/*" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) return null;
    const mime = sniffImageMime(buffer);
    if (!mime) return null;
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}
