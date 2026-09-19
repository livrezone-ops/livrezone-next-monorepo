FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Garde-fou : npm ci omet parfois les deps optionnelles platform (binaires
# natifs sharp) — observé le 19/09 (build OK, mais 500 silencieux sur les
# images OG, repli sur le PNG de marque). npm ci doit échouer ici si sharp
# n'est pas utilisable dans cette image (alpine = variante linuxmusl).
RUN npm ci --include=optional \
 && node -e "require('sharp'); console.log('sharp OK (vips', require('sharp').versions.vips + ')')"

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
# next/og (satori) finit son rendu par sharp(SVG). Or Next bloque les
# opérations VipsForeignLoad dans sharp au 1er usage de son optimiseur
# _next/image (image-optimizer.js : block global processus, SVG non
# réautorisé) → tout rendu OG échoue ensuite avec « Input buffer contains
# unsupported image format » (bug du 19/09). On force next/og sur son
# fallback resvg.wasm en shadowant sharp UNIQUEMENT pour ce module (stub qui
# rejette à l'import, attrapé par getSharp) ; le reste de l'app (conversion
# webp→PNG des couvertures, lib/og-cover.ts) garde le vrai sharp.
RUN mkdir -p /app/.next/standalone/node_modules/next/dist/compiled/@vercel/og/node_modules/sharp \
 && echo '{"name":"sharp","version":"0.0.0-stub","main":"index.js","type":"commonjs"}' \
      > /app/.next/standalone/node_modules/next/dist/compiled/@vercel/og/node_modules/sharp/package.json \
 && echo 'throw new Error("sharp stub : next/og doit utiliser resvg (le sharp.block de Next casse le chargement SVG)");' \
      > /app/.next/standalone/node_modules/next/dist/compiled/@vercel/og/node_modules/sharp/index.js

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    OG_CACHE_DIR=/var/cache/livrezone-og
COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# Cache disque des images OG (rendu satori une fois par version d'annonce) ;
# le conteneur de prod monte un volume nommé sur ce chemin (deploy.sh).
RUN mkdir -p /var/cache/livrezone-og && chown node:node /var/cache/livrezone-og
# Chromium headless : moteur de rendu des cartes OG (lib/og-render.ts via
# puppeteer-core) — qualité typographique « outil pro » impossible avec
# satori/resvg (retour propriétaire 19/09). --no-sandbox : conteneur non root.
RUN apk add --no-cache chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
USER node
EXPOSE 3000
CMD ["node", "server.js"]
