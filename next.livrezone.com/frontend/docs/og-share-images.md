# Images de partage OpenGraph (Facebook / X) des fiches annonce

*Mis en place le 19/09/2026.*

## Problème résolu

L'`og:image` des fiches annonce pointait sur la couverture brute du livre
(image verticale ~2:3). Facebook recadre les og:image dans sa carte de lien
1.91:1 → couvertures coupées haut/bas au partage.

## Solution (Design v7 — « mockup Canva », moteur Chromium)

*Historique : v1-v3 satori 1200×630 texte-heavy ; v4-v5 « visuel-first » sans
texte fin ; v6-v7 (19/09 soir) = **abandon de satori/resvg** après retour
propriétaire (« toujours flou, rendu médiocre ») — le rendu passe dans un
vrai navigateur, comme les outils pro type Canva qui exportent leurs
templates via Chromium. v8 (19/09) : design pastel fidèle à la maquette
produit. v9 (19/09 soir) : **sortie pré-réduite 1200×630** — voir « Pourquoi
la sortie 1200×630 » plus bas. v10 (19/09 soir) : ruban d'état 45° sur la
couverture.*

Carte **1200×630** (screenshot Chromium 1200×630 @ deviceScaleFactor 2 →
PNG 2400×1260 → **resize Lanczos3 1200×630 + sharpen σ0.7** → JPEG q90
chroma 4:4:4, cf. `lib/og-cache.ts`), design v8/v9 fidèle au modèle produit
LivreZone :

- **Fond clair pastel** (`linear-gradient(135deg, #ede9fe 0%, #f5f3ff 38%, #ffffff 82%)`) avec glows d'ambiance diffus.
- **Logo officiel exact** LivreZone (badge carré violet `#6D28D9` avec livre blanc + Livre en sombre et Zone en violet).
- **Couverture en mockup 3D** à droite (sans smartphone) : `perspective + rotateY(-18deg) + rotateZ(3.5deg)`, ombres portées réalistes et douces.
- **Titre géant violet du site** (`#4c1d95`, 54-92 px selon longueur, clamp 3 lignes).
- **Badges d'état en ruban incliné 45°** posé sur le coin supérieur gauche de
  la couverture (v10, demande propriétaire) : NEUF (orange `#F97316`),
  OCCASION (teal `#0d9488`), couleurs du BookCard. ⚠️ Le ruban est **frère de
  `.mockup-card`** dans `.mockup-wrap` (pas enfant) : la perspective 3D est
  portée par la carte seule, le texte du ruban reste en 2D pur (un texte dans
  l'espace 3D serait déformé = flou). Positionnement : centre du ruban fixé
  par `top/left` + `translate(-50%,-50%) rotate(-45deg)` — invariant quelle
  que soit la hauteur de couverture (le wrap est centré verticalement).
- **Prix géant orange** (`96px`, `#F97316` + `MAD` 34 px, ancien prix barré + PROMO si remise).
- **Sans ISBN** dans l'image (présent dans les balises og:description / SEO).
- Moteur : `lib/og-render.ts` (puppeteer-core + Chromium système
  `/usr/bin/chromium-browser`, installé via apk dans le Dockerfile ; browser
  singleton, rendus sérialisés, HTML 100 % data URI — zéro requête réseau).
- Les détails (description, vendeur) restent NATIFS via og:description
  (`buildSocialDescription` dans page.tsx). og:title = « Titre — 80 MAD ».

### Pourquoi la sortie 1200×630 (v9) — la vraie cause du « flou Facebook »

La chaîne v8 livrait du 2400×1260 ; Facebook affiche la carte à ~500 px dans
le fil et réduit donc d'un facteur **4,8×** avec son scaler bon marché, puis
recompresse en JPEG : c'est là que le texte se dégradait (vérifié le 19/09 :
l'image déployée était saine, 2400×1260 q90 — la dégradation est 100 % côté
Facebook). v9 livre **1200×630** (taille officiellement recommandée par
Facebook, ~2,4× l'affichage réel, suffisant pour le retina) : la pré-réduction
**Lanczos3 + sharpen léger (σ0.7)** faite par sharp maison est bien plus
propre que la réduction 4,8× de Facebook, et le sharpen pré-compense leur
recompression JPEG. Comparaison v8/v9 en conditions réelles (simulation fil
FB : 480 px + q80) : `tmp-og-test/compare.mts` — gain net sur la tenue des
traits du titre et le barré du prix.

Règle template qui en découle : **aucun texte < 24 px dans la carte** — à
l'échelle du fil (~×0,42) il tombe sous 10 px. v9 supprime donc le domaine
« livrezone.com » en image (Facebook affiche déjà LIVREZONE.COM en natif
au-dessus du titre du lien), passe badges à 22 px et épaissit le barré
(5 px).

## Architecture et fichiers

| Fichier | Rôle |
|---|---|
| `lib/og-html.ts` | **Le design v9** : template HTML/CSS de la carte (fond pastel, logo exact, titre violet géant, prix géant, badge état, couverture 3D ; aucun texte < 24 px). Fontes Noto Sans en base64 (@font-face, cache module), couverture en data URI brute. |
| `lib/og-render.ts` | Moteur : Chromium headless singleton via puppeteer-core, screenshot 1200×630 @2× → PNG. Rendus sérialisés (queue). |
| `lib/og-cover.ts` | Récupère la couverture (HTTP) → data URI BRUTE (webp/jpeg/png décodés nativement par Chrome), validation magic bytes. Plus de conversion sharp. |
| `lib/og-cache.ts` | Orchestration : cache mémoire LRU (50) → cache disque → rendu unique. Clé = sha256(TEMPLATE_VERSION + updated_at + prix + couverture). Screenshot → JPEG q90 4:4:4 via sharp. |
| `app/api/og/listing/[id]/route.ts` | Route publique GET → JPEG 1200×630. ETag + `Cache-Control: public, max-age=86400, stale-while-revalidate=604800, immutable`. id non numérique → 404. Dernier recours : `public/og-image.png` (marque) pour ne jamais renvoyer 5xx à un crawler. |
| `app/[nickname]/[slug]/page.tsx` | `generateMetadata` : `og:image` = `${SITE_URL}/api/og/listing/<id>` (1200×630). Ne **jamais** remettre l'URL de couverture brute ici. |
| `tmp-og-test/render.tsx` | Tests de rendu standalone (4 cas) sans build Next. |

## Coût CPU (décision produit)

Rendu Chromium **une seule fois par version d'annonce** (~1,2 s chaud,
~2,8 s au 1er rendu qui lance le navigateur), puis fichier statique servi du
disque (~50-80 ms). Le lancement du navigateur est un singleton : il vit
pendant toute la vie du conteneur. Cache disque sur
volume docker `livrezone-og-cache` monté sur `/var/cache/livrezone-og`
(env `OG_CACHE_DIR` dans le Dockerfile) → survit aux redéploiements.
Cloudflare / navigateurs / Facebook cachent aussi (headers immutable + ETag).

Cas dégradés :
- Couverture momentanément indisponible → rendu placeholder, en mémoire
  10 min seulement (pas gravé disque) : on réessaie plus tard.
- Échec de rendu satori → dernière PNG connue de l'annonce (stale),
  sinon PNG de marque.
- Annonce introuvable / API down → PNG de marque.

## Pièges connus

1. **satori ne décode pas le webp** (bundle `next/og` de Next 16.3 : types
   supportés = png/jpeg/gif/apng/svg uniquement). Conversion sharp
   obligatoire — sans ça, rendu silencieusement fallback.
2. **`npm ci` peut omettre les binaires natifs de sharp** (deps optionnelles
   platform). Observé le 19/09 : build OK mais toutes les images OG servaient
   le PNG de marque. Garde-fou dans le Dockerfile (stage `deps`) :
   `node -e "require('sharp')"` → le build échoue si sharp est inutilisable.
3. **satori ≠ CSS complet** : chaque `<div>` doit avoir `display: flex`, pas
   de `filter: blur()`, pas de stop de dégradé > 100 %, textes avec polices
   embarquées (Noto Sans) pour un rendu professionnel et net.
4. **JAMAIS d'emoji dans la template** : satori télécharge chaque emoji depuis
   un CDN (twemoji/jsdelivr) via fetch au rendu ; dans le runtime route
   (fetch patché par Next) l'asset arrivait corrompu et le rendu entier
   tombait sur le fallback stale (19/09). Les icônes sont des **SVG inline**
   (data URI `BOOK_ICON_WHITE` / `BOOK_ICON_PURPLE` dans `lib/og-template.tsx`).
5. **Le blocage sharp de Next casse next/og** : au premier usage de
   `/_next/image`, l'optimiseur de Next (`dist/server/image-optimizer.js`)
   appelle `sharp.block({ operation: ['VipsForeignLoad'] })` puis ne
   réautorise que png/jpeg/webp/gif/tiff/heif — **globalement au processus**.
   Or next/og finit son rendu par `sharp(SVG)` → tout rendu OG échoue ensuite
   avec « Input buffer contains unsupported image format ». Échecs
   « aléatoires » typiques : ça marche sur un conteneur neuf, casse dès que
   quelqu'un charge une image optimisée. Correctif (Dockerfile, stage
   builder) : un **stub sharp** est posé dans
   `next/dist/compiled/@vercel/og/node_modules/sharp/` (rejette à l'import,
   attrapé par `getSharp()`) → next/og utilise son fallback **resvg.wasm**,
   insensible au blocage. Le vrai sharp reste disponible pour le reste de
   l'app (conversion webp→PNG de `lib/og-cover.ts`, qui passe par un `<img>`
   data URI, pas par le SVG final).
6. **Invalidation du cache via `TEMPLATE_VERSION`** : `lib/og-cache.ts`
   intègre la constante (actuellement `"v5"` : v4 = visuel-first 2400×1260
   JPEG ; v5 = retrait des ombres) dans la signature sha256 de `versionOf()`.
   TOUT changement visuel — même un pixel — doit incrémenter cette version,
   sinon les anciennes images restent servies du disque jusqu'au prochain
   `updated_at` de l'annonce.
7. **`boxShadow` = poison à haute résolution** : le flou gaussien est
   rasterisé par resvg.wasm — une seule ombre (0 40px 90px) coûtait ~4 s à
   2400×1260, rendu entier > 10 s. Design plat obligatoire (bordures
   solid/dashed et dégradés sont quasi gratuits, < 50 ms).
8. **`npm ci` peut omettre les binaires optionnels de sharp** (déjà couvert
   en 2) et **les accès fs dynamiques déclenchent le tracing Turbopack** :
   les `readFile`/`readdir`/`existsSync` des modules og portent l'annotation
   `/*turbopackIgnore: true*/` — ne pas les retirer (sinon tout le projet est
   copié dans le standalone).
8. Pas de purge automatique du volume (~100 Ko par annonce partagée) —
   surveiller `docker exec livrezone-next du -sh /var/cache/livrezone-og`.

## Procédure de test (sans build)

Comparaison de pipelines (rendu Chromium + simulation fil FB 480 px q80),
dans le conteneur de prod (Chromium + sharp + puppeteer-core déjà là) :

```bash
sudo -n docker exec -u root livrezone-next sh -c "mkdir -p /app/og-test /tmp/og-out"
sudo -n docker cp lib/og-html.ts livrezone-next:/app/og-test/og-html.ts
sudo -n docker cp lib/og-render.ts livrezone-next:/app/og-test/og-render.ts
sudo -n docker cp tmp-og-test/compare.mts livrezone-next:/app/og-test/compare.mts
sudo -n docker exec -w /app livrezone-next sh -c "npx -y tsx og-test/compare.mts"
# récupérer : /tmp/og-out/{v8,v9,v9b}-fb.jpg (sim fil 480 px) + compare-2x.png (planche ×2)
```

⚠️ Le script doit rester sous `/app` (la résolution ESM de `sharp` part de
l'emplacement du script, pas du cwd) et se termine par `process.exit(0)` (le
navigateur singleton garde l'event loop vivant). `tmp-og-test` est exclu du
tsconfig.

## Déploiement et vérification

```bash
# build + run (volume OG obligatoire) — cf. deploy.sh
sudo -n docker build -t livrezone-next .
sudo -n docker stop livrezone-next; sudo -n docker rm livrezone-next
sudo -n docker run -d --name livrezone-next -p 3000:3000 \
  --restart unless-stopped \
  --add-host api-next.livrezone.com:192.168.1.202 \
  -e INTERNAL_API_URL=https://api-next.livrezone.com \
  -e NODE_NO_WARNINGS=1 \
  -v livrezone-og-cache:/var/cache/livrezone-og \
  livrezone-next

# vérifs
curl -s -o /tmp/og.png -w "%{http_code} %{size_download}\n" \
  https://livrezone.com/api/og/listing/133   # ≠ 43424 (= fallback marque !)
curl -s https://livrezone.com/<nick>/<slug> | grep og:image
docker exec livrezone-next ls /var/cache/livrezone-og
```

Si la réponse fait exactement **43 424 octets**, c'est le PNG de marque
(fallback) : voir `docker logs livrezone-next` (erreurs préfixées `[og]`).

Après un changement de design, purger l'aperçu Facebook via
https://developers.facebook.com/tools/debug/ (bouton « Scraper again »).

## Rollback

Image tagguée `livrezone-next:rollback-20260919b` (état avant cette fonctionnalité).
