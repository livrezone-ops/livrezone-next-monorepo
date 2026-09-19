#!/usr/bin/env bash
# Déploiement du frontend livrezone-next.
# Usage : ./deploy.sh
#
# IMPORTANT : --add-host api-next.livrezone.com:192.168.1.202 est OBLIGATOIRE.
# Sans lui, le conteneur résout api-next vers Cloudflare (DNS public) : tout le
# SSR sort sur internet et se fait rate-limiter par CF (429 « error code: 1015 »)
# → 0 annonces, fiches 404, erreurs site entier (panne du 18/09/2026 soir).
set -euo pipefail
cd "$(dirname "$0")"

# --add-host au BUILD aussi : le prérendu des sitemaps interroge l'API
# pendant `next build` ; sans lui le builder résout api-next via le DNS
# public (Cloudflare) et dépasse les 60 s par sitemap → échec du build
# (observé le 19/09 sur /sitemap-editeurs.xml).
docker build \
  --add-host api-next.livrezone.com:192.168.1.202 \
  -t livrezone-next .
docker stop livrezone-next 2>/dev/null || true
docker rm livrezone-next 2>/dev/null || true
docker run -d --name livrezone-next \
  -p 3000:3000 \
  --restart unless-stopped \
  --add-host api-next.livrezone.com:192.168.1.202 \
  -e INTERNAL_API_URL=https://api-next.livrezone.com \
  -e NODE_NO_WARNINGS=1 \
  -v livrezone-og-cache:/var/cache/livrezone-og \
  livrezone-next

sleep 5
docker logs livrezone-next --tail 5
echo "Vérifier : curl -s -o /dev/null -w '%{http_code}' https://livrezone.com/"
