# Prompt — Qualité du TEXTE de la carte OG LivreZone (Design v8)

Le site LivreZone (frontend Next.js 16.3 dans `/home/livrezone/docker-data/volumes/livrezone_html_data/_data/next.livrezone.com/frontend`) génère la carte de partage Facebook de chaque annonce via **Chromium headless** (screenshot d'un template HTML/CSS). Le pipeline est en place et validé.

Cette version **v8** résout définitivement le problème de **texte flou après compression Facebook** et adopte une direction artistique fidèle à la maquette produit LivreZone (fond pastel clair, logo exact du site, couverture 3D sans smartphone, titre géant violet, prix très grand, badge d'état conforme au `BookCard.tsx`, sans ISBN).

## Architecture (qui fait quoi — ce qui est figé)

Pipeline : `route /api/og/listing/<id>` → `lib/og-cache.ts` (caches mémoire + disque, clé de version) → `lib/og-render.ts` (Chromium screenshot 1200×630 @ deviceScaleFactor 2 → PNG 2400×1260) → conversion JPEG q90 4:4:4 → cache disque → Facebook (qui réduit à ~500 px puis recompresse).

| Fichier | Rôle | Autorisé ? |
|---|---|---|
| `lib/og-html.ts` | **LE template HTML/CSS** (design complet de la carte v8) | ✅ **Terrain d'itération visuelle** |
| `lib/og-cache.ts` | Caches, version, JPEG | ⛔ SAUF une ligne : bump `TEMPLATE_VERSION` (obligatoire à chaque itération retenue, actuellement `"v8"`) |
| `lib/og-render.ts` | Navigateur Chromium singleton, screenshot @2× | ⛔ |
| `lib/og-cover.ts` | Couverture → data URI brute | ⛔ |
| `app/api/og/listing/[id]/route.ts` | Route publique JPEG + ETag | ⛔ |
| `app/[nickname]/[slug]/page.tsx` | og:title/og:description natifs | ⛔ |
| `Dockerfile`, `deploy.sh` | Chromium, volumes, garde-fous | ⛔ |

**Interdits absolus dans le template** : aucun emoji externe ; aucune requête réseau (fontes et couverture déjà en data URI) ; pas de `transform` 3D sur du texte (le perspective/rotateY est réservé à la couverture).

---

## Diagnostic — Pourquoi le texte était flou sur Facebook et comment la v8 le corrige

1. **Downscaling Facebook agressif (2400px → 480px)** :
   - Facebook réduit la carte 2400×1260 à environ 480–500 px dans le fil d'actualité mobile/desktop.
   - Tout texte avec une taille CSS < 30 px (comme l'ancien ISBN à 26 px ou les sous-titres fins) devenait un filet de 6 à 8 pixels à peine visible, annihilé par la recompression JPEG.
   - **Correction v8** : Suppression des micro-textes (ISBN retiré), Titre géant (54 à 92 px) et Prix géant (96 px). Réduits à 500 px, ils restent massifs (~20–35 px) et ultra nets.

2. **Artefacts DCT JPEG sur fonds sombres avec glows** :
   - L'ancien fond noir v7 avec des halos radiaux provoquait du bruit de quantification ("mosquito noise") autour des glyphes clairs.
   - **Correction v8** : Passage à un **fond pastel clair** (`linear-gradient(135deg, #ede9fe 0%, #f5f3ff 38%, #ffffff 82%)`). Le contraste entre le texte violet profond `#4c1d95` / `#6D28D9` et le fond clair pastel élimine les halos de compression.

3. **Graisse typographique et netteté** :
   - Graisse `800` (Noto Sans ExtraBold) sur tous les éléments clés.
   - Propriétés `-webkit-font-smoothing: antialiased;` et `text-rendering: optimizeLegibility;`.
   - Chroma subsampling 4:4:4 préservé dans `sharp`.

---

## Spécifications Design v8 (Fidèle au modèle)

1. **Fond** : Dégradé doux lavande/violet clair vers blanc pur, avec deux lueurs d'ambiance très diffuses.
2. **Logo Officiel LivreZone** :
   - Badge violet `#6D28D9` avec l'icône livre en blanc (`stroke-width: 2.4`).
   - Nom de marque : `Livre` en `#0F172A` (ardoise sombre) et `Zone` en `#6D28D9` (violet officiel).
3. **Badges d'état (`BookCard.tsx`)** :
   - Neuf : Fond orange `#F97316`, texte blanc `NEUF`, gras 800, majuscules avec tracking.
   - Occasion : Fond sarcelle/teal `#0d9488`, texte blanc `OCCASION`, gras 800.
4. **Titre du livre** :
   - Couleur : Violet foncé officiel du site (`#4c1d95`).
   - Taille : 54 à 92 px selon la longueur (clamp 3 lignes).
5. **Prix en très grand** :
   - Taille : `96px`, couleur orange vif `#F97316`.
   - Devise : `MAD` à 34 px en gras ardoise `#475569`.
   - Remise / Promo : Ancien prix barré en `34px` + badge `PROMO` en fond orange si réduction active.
6. **Sans ISBN** : Retiré de l'image (présent uniquement dans les balises `og:description` / SEO).
7. **Couverture 3D** :
   - Perspective 3D inclinée (`rotateY(-18deg) rotateZ(3.5deg)`), ombres portées réalistes et douces.
   - Sans le smartphone de la maquette originale (produit physique mis en valeur).

---

## Cas de test

1. Annonce standard (Titre moyen + Couverture réelle + Neuf + Prix simple).
2. Annonce promo (Titre court + Occasion + Prix remisé + Ancien prix barré + Badge PROMO).
3. Annonce titre très long (clamp 3 lignes avec ellipsis + sans couverture/placeholder + prix décimal).
4. Fallback marque (prix 0, sans couverture).

---

## Déploiement et Vérification

1. Bump `TEMPLATE_VERSION = "v8"` dans `lib/og-cache.ts`.
2. Déploiement via le script officiel :
   ```bash
   ssh ouahib@192.168.1.202
   lz
   ```
3. Vérification :
   ```bash
   curl -s -o /tmp/og.jpg -w "%{size_download}" http://192.168.1.202:3000/api/og/listing/133
   ```
4. Purger le cache Facebook Debugger : https://developers.facebook.com/tools/debug/
