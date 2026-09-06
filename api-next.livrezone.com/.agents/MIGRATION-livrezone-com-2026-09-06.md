# Migration domaine frontend : `next.livrezone.com` → `livrezone.com`

**Date de décision : 06/09/2026 (propriétaire). Option retenue : POINTEUR.**
`livrezone.com` pointe vers le conteneur existant `livrezone-next` (aucune copie de fichiers, aucun second conteneur). `next.livrezone.com` reste fonctionnel pendant la transition puis devient 301.

**Pourquoi pas la copie** : le site est servi par le conteneur Docker (`Caddy → 192.168.1.202:3000 → livrezone-next`), pas depuis un dossier. Une copie imposerait une 2ᵉ image + 2ᵉ conteneur (RAM sur slice plafonnée 6 Go — cf. incident 524), un 2ᵉ contexte de build (`lz`) et un drift dev/prod garanti. L'option pointer est réversible en 2 minutes.

**Invariant** : le dossier de build reste `_data/next.livrezone.com/frontend` ; le nom du dossier devient un détail interne. Le domaine API `api-next.livrezone.com` **ne change pas** → OAuth Google (callback sur l'API), `APP_URL`, `NEXT_PUBLIC_API_URL` : rien à faire.

**Règle Caddy (leçon incident 521)** : ne JAMAIS déposer de `.bak`/copie dans `/etc/openpanel/caddy/domains/` — le glob `import domains/*` charge tout fichier. Sauvegardes → `/etc/openpanel/caddy/`.

---

## Étape 0 — Préparation (code + config locale) — 🔄 EN COURS 06/09

### 0a. Backend — URLs en dur → config

| Fichier | Ligne | Avant | Après |
|---|---|---|---|
| `app/Services/TelegramNotificationService.php` | 36 | `'https://next.livrezone.com'` | `config('app.frontend_url')` |
| `app/Jobs/NotifyDemandersOnListingPublished.php` | 80-81 | idem (2 occurrences) | idem |
| `app/Notifications/BookOrderedNotification.php` | 46 | idem | idem |
| `app/Services/NotificationContentService.php` | 31, 33 | idem (2 occurrences) | idem |

Comportement **identique aujourd'hui** (`config/app.php:68` → `FRONTEND_URL=https://next.livrezone.com` : même valeur). Le changement ne produira un effet qu'à l'Étape 2. Vérifié : `config/app.php:68 'frontend_url' => env('FRONTEND_URL', 'http://localhost:3000')`.

### 0b. Frontend — domaine du site centralisé

- Nouveau : `lib/site-url.ts` → `export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://next.livrezone.com";`
- Remplacement des constantes en dur (`const SITE_URL = "https://next.livrezone.com"`) par import dans : `app/robots.ts`, `app/sitemap.ts`, `app/layout.tsx` (metadataBase + JSON-LD Organization/WebSite), `app/page.tsx`, `app/annonces/page.tsx`, `app/books/page.tsx`, `app/books/themes/[code]/page.tsx`, `app/librairies/page.tsx`, `app/demandes/page.tsx`, `app/[nickname]/page.tsx`, `app/[nickname]/[slug]/page.tsx`.
- Headers `Referer: https://next.livrezone.com` des fetchs SSR (utilisés par Sanctum stateful) pilotés par `SITE_URL` : `app/dashboard/page.tsx`, `lib/listings-api.ts`, `lib/admin-auth.ts`, `app/api/hero-messages/route.ts`, `app/demandes/page.tsx`, `app/page.tsx`.
- **Non touché** (domaine API, inchangé) : tous les fallbacks `process.env.NEXT_PUBLIC_API_URL || "https://api-next.livrezone.com..."` (~16 occurrences), les constructions d'URLs de couvertures/logos sur `api-next`, `lib/chat-realtime.ts` (Reverb), `next.config.ts` remotePatterns.
- `.env.production` : ajout `NEXT_PUBLIC_SITE_URL=https://next.livrezone.com` (la valeur passera à `https://livrezone.com` à l'Étape 2, suivie d'un `lz`).

### 0c. Quick wins audit (C1 + C4) sur le même passage

- `.env` backend : `APP_ENV=local → production`, `APP_DEBUG=true → false`, `LOG_CHANNEL=stack → daily` (rotation 14 jours, canal `daily` vérifié `config/logging.php:68-72`), `LOG_LEVEL=debug → info`. Vérifié : **aucun** `app()->environment()` dans `app/` → changement sans effet de bord. (Sauvegarde préalable : `.env.bak-20260906-avant-production` — hors git.)
- Logs exposés dans le webroot déplacés (pas supprimés) vers `storage/logs/archive-20260906/` : `public/check-listings.log`, `public/test-covers.log` (fichiers non suivis par git — copies d'inspection du 13/08).

### Vérifications de l'étape 0

- [x] `vendor/bin/pint --test` sur les 4 fichiers backend modifiés → PASS (4 files)
- [x] `npx tsc --noEmit` frontend → 0 erreur
- [x] `npx eslint app lib components hooks` → 0 erreur (23 warnings préexistants, fichiers non touchés)
- [x] Aucune référence `next.livrezone.com` restante côté frontend hors fallback `lib/site-url.ts` (toutes les autres = domaine API, inchangé)
- [x] `.env` vérifié après sed : `APP_ENV=production`, `APP_DEBUG=false`, `LOG_CHANNEL=daily`, `LOG_LEVEL=info`
- [x] `public/` propre : logs déplacés vers `storage/logs/archive-20260906/`
- [x] Commits locaux (push après validation propriétaire)
- [ ] **Test propriétaire** : voir checklist en bas de page
- [ ] `lz` (nécessaire : le frontend a changé)
- [ ] push

---

## Journal

| Date | Action | Résultat |
|---|---|---|
| 06/09 | Décision propriétaire : option POINTEUR validée | — |
| 06/09 | Roadmap consolidée `.agents/roadmap.md` | ✅ |
| 06/09 | Étape 0a : 5 URLs backend + fallback blade → `config('app.frontend_url')` | ✅ pint PASS — comportement identique tant que `FRONTEND_URL` inchangé |
| 06/09 | Étape 0b : `lib/site-url.ts` + 15 fichiers front (`SITE_URL`, Referer SSR) + `NEXT_PUBLIC_SITE_URL` dans `.env.production` | ✅ tsc 0 err, eslint 0 err |
| 06/09 | Étape 0c : `.env` durci (production/debug off/logs daily/info) + logs publics archivés | ✅ (ancien laravel.log unique conservé ; nouvelle rotation 14 j dès le prochain log) |
| 06/09 | Test propriétaire + `lz` : validé (« c fait ») | ✅ |
| 06/09 | Push des commits (57149b3 docs, 3aa71d7 backend, 529f6d3 front + journal) | ✅ |
| 06/09 | Étape 1 — tentative 1 : reload **rejeté** (`ambiguous site definition: https://next.livrezone.com` — copie non éditée = double déclaration du site, mécanisme identique à la panne 521 du 02/09). Caddy est resté sur l'ancienne config (aucune coupure) ; les 200 constatés = placeholder, PAS le site. ⚠️ Leçon : éditer le server_name AVANT le reload, et tant que l'ambiguïté existe, un restart de Caddy = outage global | ⚠️ corrigé |
| 06/09 | Étape 1 — tentative 2 : `sed -E 's/(^|[^-a-zA-Z0-9])next\.livrezone\.com/\1livrezone.com/g'` (garde anti-hyphen pour préserver `api-next.livrezone.com`) sur les 6 occurrences (blocs http/https, `domain_log`, `SecAuditLog` Coraza) → `Valid configuration` → reload OK → `_next` servi sur Host livrezone.com en interne | ✅ |
| — | En attente : vérification externe https://livrezone.com (navigateur) → puis Étape 2 | ⏳ |

---

## Étape 1 — Caddy : pointer `livrezone.com` vers le conteneur — ✅ FAIT 06/09

**Résultat** : conf créée par copie de `next.livrezone.com.conf` + renommage des 6 occurrences du domaine (sed avec garde `(^|[^-a-zA-Z0-9])next\.livrezone\.com` pour ne pas toucher `api-next.livrezone.com`). Sauvegarde de l'ancienne conf : `/etc/openpanel/caddy/livrezone.com.conf.removed-20260906`. `caddy validate` OK, reload à chaud OK, `_next` servi sur `Host: livrezone.com` en interne.

```bash
# 1. Sauvegarder la conf actuelle HORS du dossier importé (leçon 521)
sudo -n cp /etc/openpanel/caddy/domains/livrezone.com.conf /etc/openpanel/caddy/livrezone.com.conf.removed-20260906

# 2. Créer la nouvelle conf : copie de next.livrezone.com.conf avec server_name et proxy
#    (server_name livrezone.com www.livrezone.com ; reverse_proxy http://192.168.1.202:3000 —
#    PAS 127.0.0.1 : loopback refusé par le proxy Docker, documenté dans audit-infra.md)
sudo -n cp /etc/openpanel/caddy/domains/next.livrezone.com.conf /etc/openpanel/caddy/domains/livrezone.com.conf
sudo -n nano /etc/openpanel/caddy/domains/livrezone.com.conf   # adapter server_name

# 3. Valider puis recharger À CHAUD (pas de restart — méthode éprouvée 02/09)
sudo -n docker exec caddy caddy validate --config /etc/openpanel/caddy/Caddyfile --adapter caddyfile
sudo -n docker exec caddy caddy reload --config /etc/openpanel/caddy/Caddyfile --adapter caddyfile

# 4. Vérification
sudo -n curl -s -o /dev/null -w "%{http_code}\n" -H "Host: livrezone.com" http://192.168.1.202/
sudo -n curl -s -o /dev/null -w "%{http_code}\n" https://livrezone.com
```

À ce stade : les DEUX domaines servent le même conteneur, aucune rupture possible. Cloudflare : vérifier que l'apex est proxifié (orange) en Full (strict) comme next.

**Rollback** : `mv` la conf restaurée dans `domains/` + reload. Rien d'autre n'a bougé.

## Étape 2 — Bascule config — ⏳

```bash
# Backend .env (php-fpm relit .env à chaque requête — pas de config cache ; optimize:clear par sûreté)
FRONTEND_URL=https://livrezone.com
SANCTUM_STATEFUL_DOMAINS=next.livrezone.com,livrezone.com
DOCKER_HOST=unix:///run/user/1001/docker.sock sudo -n docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan optimize:clear

# Frontend .env.production + rebuild
NEXT_PUBLIC_SITE_URL=https://livrezone.com
lz
```

Automatique via `FRONTEND_URL` : CORS (`config/cors.php` ajoute l'origine validée). Inchangé : `SESSION_DOMAIN=.livrezone.com` (sessions préservées), OAuth Google, `APP_URL`, `NEXT_PUBLIC_API_URL`, Reverb.

## Étape 3 — Recette — ⏳

- [ ] Login email + OAuth Google (nouvelle session et session existante conservée)
- [ ] Chat temps réel (Reverb : message entre 2 comptes)
- [ ] Images optimisées `/_next/image` (couvertures + avatar Google)
- [ ] Email reset password + vérification → liens vers `https://livrezone.com/...`
- [ ] Notification Telegram → lien vers `https://livrezone.com/...`
- [ ] canonical/OG en view-source (annonces, livres, profils) + `sitemap.xml` + `robots.txt`
- [ ] Parcours achat complet (panier → commande) + notifications

## Étape 4 — 301 next → livrezone — ⏳ (J+7/14)

Remplacer le contenu de `domains/next.livrezone.com.conf` par une redirection 301 `https://livrezone.com{uri}` (apex+www), reload à chaud. Garder la conf précédente en sauvegarde hors du dossier importé.

---

## Checklist de test — Étape 0 (avant push)

À exécuter côté propriétaire après ce commit :

```bash
# 1. Rebuild + redéploiement du frontend (obligatoire : le code front a changé)
lz

# 2. Backend : le .env est relu à chaque requête (pas de config cache) — rien à faire.
#    Par sûreté si un comportement semble stale :
DOCKER_HOST=unix:///run/user/1001/docker.sock sudo -n docker exec php-fpm-8.5 \
  php /var/www/html/api-next.livrezone.com/artisan optimize:clear
```

Puis vérifier sur **https://next.livrezone.com** (tout doit être identique à avant — aucun changement de comportement à cette étape) :

- [ ] Accueil : hero + grilles chargées (SSR listings OK)
- [ ] `/annonces` : recherche + filtres + pagination
- [ ] `/books` : catalogue + fiche livre
- [ ] Login + `/dashboard` : listings chargés (fetch SSR avec Referer = SITE_URL — Sanctum stateful OK)
- [ ] Chat : envoi + réception temps réel
- [ ] Créer/modifier une annonce → vérifier le message Telegram admin : lien `https://next.livrezone.com/books/{id}` (valeur identique, vient maintenant de `FRONTEND_URL`)
- [ ] `view-source` accueil : JSON-LD Organization/WebSite avec `https://next.livrezone.com` (valeur identique)
- [ ] `robots.txt` + `sitemap.xml` accessibles
- [ ] Logs : `storage/logs/` contient désormais `laravel-YYYYMMDD.log` (rotation journalière active) — `laravel.log` ne grossit plus
