// Template HTML/CSS de la carte OG — Version v10 (fidèle à la maquette produit LivreZone).
// Design épuré, fond pastel clair dégradé, titre géant dans le violet du site (#4c1d95 / #6D28D9),
// couverture en perspective 3D (sans smartphone), prix géant (#F97316 + MAD),
// badge état en ruban incliné 45° sur le coin de la couverture (NEUF / OCCASION,
// couleurs du BookCard), sans ISBN, et logo officiel exact.
//
// Rendu par Chromium headless (lib/og-render.ts) : viewport 1200×630 @2x -> 2400×1260,
// puis pré-réduction 1200×630 côté cache (v9). Tout texte < 24 px est banni :
// réduit à ~500 px par Facebook, il tombe sous 10 px et devient illisible.
// Zéro requête réseau du navigateur : polices Noto Sans et couverture embarquées en data URI.

export interface OgCardData {
  title: string;
  /** Prix affiché (discount_price si présent) — 0 = pas de bloc prix. */
  price: number;
  /** Prix d'origine, barré, uniquement si discount_price est appliqué. */
  originalPrice?: number | null;
  condition?: string | null;
  isbn?: string | null;
  /** Couverture en data URI (image brute, Chrome décode webp/jpg/png). */
  coverDataUri?: string | null;
}

const MAX_TITLE_LENGTH = 75;

function fitTitle(title: string): string {
  const t = title.trim().replace(/\s+/g, " ");
  if (t.length <= MAX_TITLE_LENGTH) return t;
  return `${t.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`;
}

function titleFontSize(len: number): number {
  if (len <= 16) return 92;
  if (len <= 32) return 76;
  if (len <= 50) return 64;
  return 54;
}

function formatPrice(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

// Fontes Noto Sans du front en base64 pour @font-face (mises en cache).
let fontsCss: string | null = null;

async function loadFontsCss(): Promise<string> {
  if (fontsCss) return fontsCss;
  const weights: Array<[string, number]> = [
    ["NotoSans-Regular.ttf", 400],
    ["NotoSans-SemiBold.ttf", 600],
    ["NotoSans-Bold.ttf", 700],
    ["NotoSans-ExtraBold.ttf", 800],
  ];
  const rules = await Promise.all(
    weights.map(async ([file, weight]) => {
      const { readFile } = await import("node:fs/promises");
      const path = await import("node:path");
      // turbopackIgnore : chemin env/public runtime
      const p = path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "fonts", file);
      const b64 = (await readFile(/*turbopackIgnore: true*/ p)).toString("base64");
      return `@font-face { font-family: 'NotoSans'; src: url(data:font/ttf;base64,${b64}) format('truetype'); font-weight: ${weight}; font-style: normal; font-display: block; }`;
    }),
  );
  fontsCss = rules.join("\n");
  return fontsCss;
}

function conditionBadgeClass(condition?: string | null): string {
  if (condition === "neuf") return "cover-badge neuf";
  if (condition === "occas") return "cover-badge occas";
  return "";
}

function priceBlock(data: OgCardData): string {
  if (!(data.price > 0)) return "";
  const hasPromo = data.originalPrice && data.originalPrice > data.price;
  const promoHtml = hasPromo
    ? `<span class="old-price">${formatPrice(data.originalPrice!)} MAD</span><span class="promo-badge">PROMO</span>`
    : "";

  return `
    <div class="price-container">
      <div class="price-main">
        <span class="price-val">${formatPrice(data.price)}</span>
        <span class="price-cur">MAD</span>
        ${promoHtml}
      </div>
    </div>
  `;
}

function coverBlock(data: OgCardData): string {
  // Badge état en ruban incliné 45° posé sur le coin supérieur gauche de la
  // couverture (demande propriétaire). Il est FRÈRE de .mockup-card, pas
  // enfant : le badge ne doit pas hériter de la perspective 3D de la
  // couverture (texte déformé = flou garanti).
  const badge = conditionBadgeClass(data.condition);
  const badgeHtml = badge
    ? `<div class="${badge}">${data.condition === "neuf" ? "NEUF" : "OCCASION"}</div>`
    : "";
  if (data.coverDataUri) {
    return `
      <div class="mockup-wrap">
        <div class="mockup-card">
          <img src="${data.coverDataUri}" alt="">
        </div>
        ${badgeHtml}
      </div>
    `;
  }
  return `
    <div class="mockup-wrap">
      <div class="mockup-card placeholder">
        <svg class="ph-book" viewBox="0 0 24 24" fill="none" stroke="#6D28D9" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
        <div class="ph-text">Couverture<br>non disponible</div>
      </div>
      ${badgeHtml}
    </div>
  `;
}

export async function buildCardHtml(data: OgCardData): Promise<string> {
  const fonts = await loadFontsCss();
  const title = fitTitle(data.title);
  const priceHtml = priceBlock(data);
  const coverHtml = coverBlock(data);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
${fonts}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  width: 1200px;
  height: 630px;
  overflow: hidden;
  background: #f8fafc;
}
body {
  font-family: 'NotoSans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

/* Carte principale avec fond pastel clair dégradé fidèle au modèle */
.card {
  position: relative;
  width: 1200px;
  height: 630px;
  overflow: hidden;
  background: linear-gradient(135deg, #ede9fe 0%, #f5f3ff 38%, #ffffff 82%);
}

/* Glows subtils en arrière-plan pour la profondeur */
.ambient-glow-1 {
  position: absolute;
  top: -180px;
  left: -120px;
  width: 650px;
  height: 650px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(109, 40, 217, 0.14) 0%, rgba(237, 233, 254, 0) 70%);
}
.ambient-glow-2 {
  position: absolute;
  bottom: -200px;
  right: 160px;
  width: 700px;
  height: 700px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(124, 58, 237, 0.08) 0%, rgba(255, 255, 255, 0) 70%);
}

/* Colonne Contenu (Gauche) */
.content-col {
  position: absolute;
  left: 76px;
  top: 50px;
  bottom: 50px;
  width: 630px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  z-index: 10;
}

.top-section {
  display: flex;
  flex-direction: column;
}

/* Logo Exact du Site LivreZone */
.brand-header {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-bottom: 26px;
}
.logo-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: #6D28D9;
  border-radius: 12px;
  box-shadow: 0 4px 14px rgba(109, 40, 217, 0.28);
}
.logo-icon {
  width: 28px;
  height: 28px;
}
.brand-title {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.8px;
  line-height: 1;
}
.brand-livre {
  color: #0F172A;
}
.brand-zone {
  color: #6D28D9;
}

/* Badge d'état en ruban incliné 45° posé sur le coin supérieur gauche de la
   couverture (conforme aux couleurs du BookCard.tsx du site). Frère de
   .mockup-card dans .mockup-wrap : PAS de perspective 3D sur le texte.
   top/left = position du CENTRE du ruban (translate -50 % avant rotation). */
.cover-badge {
  position: absolute;
  top: 50px;
  left: -14px;
  transform: translate(-50%, -50%) rotate(-45deg);
  padding: 8px 30px;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: #ffffff;
  border-radius: 6px;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.25);
  white-space: nowrap;
}
.cover-badge.neuf {
  background: #F97316;
}
.cover-badge.occas {
  background: #0d9488;
}

/* Titre Géant dans le Violet Officiel du Site */
.book-title {
  color: #4c1d95;
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: -1.8px;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
}

/* Section Inférieure : Prix Très Grand
   (pas de domaine en image : Facebook affiche déjà « LIVREZONE.COM » en
   natif au-dessus du titre du lien, et un texte de 22 px y serait de la
   bouillie après leur réduction à ~500 px) */
.bottom-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.price-container {
  display: flex;
  align-items: baseline;
}
.price-main {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 12px;
}
.price-val {
  font-size: 96px;
  font-weight: 800;
  color: #F97316;
  line-height: 0.95;
  letter-spacing: -3px;
}
.price-cur {
  font-size: 34px;
  font-weight: 800;
  color: #475569;
  letter-spacing: -0.5px;
}
.old-price {
  font-size: 34px;
  font-weight: 700;
  color: #94a3b8;
  /* Barré épais : le trait fin (~2 px à 1200) tombe à <1 px après la
     réduction Facebook et devient une traînée illisible. */
  text-decoration: line-through;
  text-decoration-thickness: 5px;
  margin-left: 10px;
}
.promo-badge {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 1px;
  color: #ffffff;
  background: #F97316;
  padding: 7px 16px;
  border-radius: 6px;
  margin-left: 8px;
  box-shadow: 0 2px 8px rgba(249, 115, 22, 0.3);
}

/* Maquette Couverture 3D (Droite - Fidèle à la maquette Magazine sans téléphone).
   La perspective 3D est sur .mockup-card (pas sur le wrap) pour que le ruban
   .cover-badge, frère de la carte, reste en 2D pur. */
.mockup-wrap {
  position: absolute;
  right: -50px;
  top: 50%;
  transform: translateY(-50%);
  width: 440px;
  z-index: 5;
}
.mockup-card {
  width: 100%;
  border-radius: 6px;
  background: #ffffff;
  box-shadow:
    28px 36px 75px rgba(76, 29, 149, 0.22),
    10px 18px 36px rgba(15, 23, 42, 0.14),
    0 0 0 1px rgba(255, 255, 255, 0.8);
  overflow: hidden;
  transform: perspective(1500px) rotateY(-18deg) rotateZ(3.5deg);
}
.mockup-card img {
  display: block;
  width: 100%;
  height: auto;
  max-height: 560px;
  object-fit: contain;
}

/* Placeholder si couverture non disponible */
.mockup-card.placeholder {
  width: 410px;
  height: 530px;
  background: linear-gradient(150deg, #ede9fe 0%, #ddd6fe 100%);
  border: 2px dashed rgba(109, 40, 217, 0.35);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px;
}
.ph-book {
  width: 100px;
  height: 100px;
  margin-bottom: 24px;
}
.ph-text {
  font-size: 26px;
  font-weight: 700;
  color: #5b21b6;
  line-height: 1.35;
}
</style>
</head>
<body>
  <div class="card">
    <div class="ambient-glow-1"></div>
    <div class="ambient-glow-2"></div>
    ${coverHtml}
    <div class="content-col">
      <div class="top-section">
        <div class="brand-header">
          <div class="logo-box">
            <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </div>
          <div class="brand-title">
            <span class="brand-livre">Livre</span><span class="brand-zone">Zone</span>
          </div>
        </div>
        <div class="book-title" style="font-size: ${titleFontSize(title.length)}px;">
          ${title}
        </div>
      </div>
      <div class="bottom-section">
        ${priceHtml}
      </div>
    </div>
  </div>
</body>
</html>`;
}
