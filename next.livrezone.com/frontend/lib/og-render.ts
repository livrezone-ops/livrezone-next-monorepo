// Rendu de la carte OG via Chromium headless (Puppeteer).
// Pourquoi un navigateur (retour utilisateur 19/09 : « flou, rendu médiocre,
// comme Canva ») : Canva et les outils pro de génération de visuels rendent
// leurs templates dans un vrai moteur de navigateur — antialiasing du texte
// avec hinting sous-pixel, scaling d'images haute qualité, ombres/effets CSS
// natifs. Satori/resvg.wasm (l'ancien moteur) est nettement en dessous.
//
// Le navigateur est un singleton (lancement ~1 s, réutilisé entre les rendus,
// lui-même mise en cache par le cache disque des images). Les rendus sont
// sérialisés : la fréquence de scrape est très faible et le CPU reste
// prévisible.
import type { Browser } from "puppeteer-core";

let browserPromise: Promise<Browser> | null = null;
let queue: Promise<unknown> = Promise.resolve();

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = import("puppeteer-core")
      .then((p) =>
        p.launch({
          executablePath:
            process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium-browser",
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--hide-scrollbars",
            "--force-color-profile=srgb",
          ],
        }),
      )
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

/**
 * Rend un document HTML complet en PNG 2400×1260 (viewport 1200×630,
 * deviceScaleFactor 2). Le HTML embarque tout en data URI (fontes, images) :
 * aucun accès réseau du navigateur.
 */
export async function renderCardPNG(html: string): Promise<Buffer> {
  const run = async (): Promise<Buffer> => {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 2 });
      await page.setContent(html, { waitUntil: "load", timeout: 10000 });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          Array.from(document.images).map((img) =>
            img.decode().catch(() => undefined),
          ),
        );
      });
      const result = await page.screenshot({ type: "png", optimizeForSpeed: true });
      return Buffer.from(result);
    } finally {
      await page.close().catch(() => undefined);
    }
  };

  // Sérialise les rendus (un seul onglet actif) sans refuser le travail.
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}
