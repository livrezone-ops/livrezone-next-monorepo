# Roadmap LivreZone — Backlog consolidé 06/09/2026

> Source : backlog validé du 03/09 (décisions propriétaire) + audit technique complet du 06/09 (`.agents/AUDIT-2026-09-06.md`) + décision propriétaire du 06/09 : **migration du domaine frontend par POINTEUR** (pas de copie de fichiers). Détail opérationnel : `.agents/MIGRATION-livrezone-com-2026-09-06.md`.
> Règle de session : chaque étape documentée ; git push après validation de test du propriétaire ; `lz` quand le frontend change.

## 🔴 Priorité 1 — Migration domaine frontend `next.livrezone.com` → `livrezone.com` (option pointer)

Décision propriétaire 06/09 : on POINTE le domaine vers le conteneur existant `livrezone-next` (aucune copie de fichiers, aucun second conteneur). Le dossier de build reste `_data/next.livrezone.com/frontend`. Rollback à tout moment = restaurer la conf Caddy sauvegardée + `FRONTEND_URL`.

| Étape | Contenu | Statut |
|---|---|---|
| **0. Préparation** | a) Backend : 5 URLs `https://next.livrezone.com` en dur → `config('app.frontend_url')` (TelegramNotificationService, NotifyDemandersOnListingPublished, BookOrderedNotification, NotificationContentService). b) Front : centraliser le domaine du site dans `lib/site-url.ts` (`NEXT_PUBLIC_SITE_URL`, fallback actuel) — robots/sitemap/layout/SITE_URL/Referer SSR. c) Quick wins audit C1/C4 : `APP_ENV=production`, `APP_DEBUG=false`, `LOG_CHANNEL=daily`, `LOG_LEVEL=info` + archivage des logs exposés dans `public/`. | ✅ 06/09 |
| **1. Caddy** | Sauvegarder `domains/livrezone.com.conf` HORS de `domains/` (leçon 521), copier `next.livrezone.com.conf` → `livrezone.com.conf` (server_name apex+www, proxy `192.168.1.202:3000`, WAF Coraza et règle `/_next/image` hérités), `caddy validate` + reload à chaud, curl 200. | ✅ 06/09 |
| **2. Bascule config** | `FRONTEND_URL=https://livrezone.com` + `NEXT_PUBLIC_SITE_URL=https://livrezone.com` (front, puis `lz`) + `SANCTUM_STATEFUL_DOMAINS=next.livrezone.com,livrezone.com` + `optimize:clear`. CORS suit automatiquement (`config/cors.php` lit `FRONTEND_URL`). `SESSION_DOMAIN=.livrezone.com` et OAuth Google : rien à faire. | ✅ 06/09 |
| **3. Recette** | Login + OAuth Google, chat temps réel (Reverb), images `/_next/image`, liens Telegram/mails (reset, verification, paiement), canonicals en view-source, sitemap/robots. **Validée propriétaire 06/09 soir (« ça marche à 100 % »)** — en passant : broadcast Reverb serveur réparé (il passait par Cloudflare → 404 ; désormais interne `reverb:6060`), panier multi-vendeurs réparé (`user_id` manquant dans `fetchCart` → un seul groupe/lien WhatsApp) et messages reset password explicites. Détails : `MIGRATION-livrezone-com-2026-09-06.md`. | ✅ 06/09 |
| **4. 301** | Pose AVANCÉE le 06/09 à 20:20 (go propriétaire, sudo docker NOPASSWD) : conf `next.livrezone.com` → 301 `https://livrezone.com{uri}`, validate+reload à chaud. Vérifié : 301 avec chemin+query préservés (home, /books, /annonces?page=2, fiche annonce), 0 régression (livrezone.com + api-next 200), backup ancienne conf dans `/tmp/` + `.agents/caddy-backups/`. `www.next.livrezone.com` sans DNS (bloc inerte). Fin du contenu dupliqué. Reste propriétaire : inspection GSC de `https://livrezone.com` + vérif 404 sous 48 h. | ✅ 06/09 |

## 🟠 Priorité 2 — Finir le site (Étape 1 du backlog 03/09)

Parcours publics restants + manques produit (revue 29/08). Ajouts 06/09 :
- **Vitrine `/books` : section « Nouveautés » réintroduite** (décision propriétaire 06/09) —
  12 titres via UNE requête Meili plafonnée (`sort=recent`, `facets=0`), servie en SSR.
  Le code + l'incident associé : `.agents/incident-index-books-20260906.md`.
- **Filtre matière (`default_subject_id`) : LIVRÉ 06/09 soir** — champ indexé (réimport du
  matin) + filtre API `?subject=CODE` (`ReferenceFilterService::resolveSubjectIds`,
  `BookCatalogueService`), facettes `subjects` (codes, comptes), section « Matière » dans
  la sidebar /books (opt-in, liste statique `SUBJECTS` alignée sur la table `subjects`),
  cap Meili `maxTotalHits` relevé 1000 → 1 000 000 (les totaux affichaient « 1000 » pour
  toute requête > 1000 matchs ; persisté dans `books:configure-search` via PATCH HTTP, le
  SDK embarqué n'exposant pas la méthode). Validé propriétaire 06/09.
- **OpenGraph réparé (06/09 soir)** : `/og-image.png` (1200×630, bannière de marque)
  référencée par le layout mais ABSENTE de `public/` depuis l'origine + les pages qui
  redéfinissent `openGraph` remplaçaient tout (og:url/og:image perdus). Helper
  `lib/og.ts` (`ogDefaults()`/`ogImage()`/`ogImageUrl()`) répandu sur les ~10 pages ;
  fiches annonce : couverture en og:image avec bannière de marque en repli.
- **Titres doublés « | LivreZone | LivreZone » corrigés (06/09 soir)** — le template
  `%s | LivreZone` du layout s'ajoutait à des titres de page qui finissaient déjà par
  le suffixe (annonces, demandes, librairies, bibliothèques, fiches annonce/livre).
- **Lien Telegram admin → fiche annonce (06/09 soir, demande propriétaire)** :
  `TelegramNotificationService` pointait `/books/{id}` ; désormais
  `/{nickname}/{id}-{isbn}-{titre-slugifié}` (format `[nickname]/[slug]` du front,
  vérifié 200 en ligne).
- Enquête : identifier l'origine des builds front du 05/09 soir (22h41 → 02h47) et
  du run manuel Meili 05/09 02:40 (cause de l'appauvrissement de l'index books).

## 🟠 Priorité 3 — Quick wins audit C5-C7 — ✅ FAITS le 06/09 soir

- **C5 ✅** : cap `limit` ≤ 50 sur `GET /api/listings` (vérifié live : `?limit=100000` → per_page 50) + `/listings` et `/listings/{id}` sous `throttle:catalogue` (no-op tant que `ANTI_SCRAPING_ENABLED=false`, cap 10/min/IP dès activation — décision propriétaire pour le flippage).
- **C6 ✅** : import `Illuminate\Validation\ValidationException` ajouté dans `AdminController.php`.
- **C7 ✅** : garde `Schema::hasTable` sur les 3 migrations destructrices (`rebuild_orders_table`, `create_payments_table`, `create_notification_preferences_table`) + `migrate --force` ajouté au script `lz` (0 migration en attente au 06/09) + **`NODE_TLS_REJECT_UNAUTHORIZED=0` retiré du script `lz`** (audit). Backup `/usr/local/bin/lz.bak-20260906`.
- **Audit CRITIQUE #2 ✅** : l'endpoint public non borné `/api/sitemap/listings` (0 hit dans les logs) est supprimé, remplacé par le contrôleur paginé `SitemapController` (bornes de chunks, throttle 60/min).

## 🛡️ Sécurité — inventaire post-lz 06/09 soir (audit C1-C7 soldé)

**Réglé et vérifié** : APP_ENV/APP_DEBUG/LOG_LEVEL corrects ; rien d'exposé dans `public/` ; pas de Telescope/Horizon/debugbar ; HSTS preload + nosniff + X-Frame-Options en place ; cookies `secure` + `http_only` ; rate limits (auth 5/min, catalogue 300/min/IP avec vraies IPs, sitemap 60/min) ; Cloudflare devant les 2 domaines (Bot Fight + rate limit edge + Always Use HTTPS + www→apex) ; NODE_TLS retiré du lz ; migrations destructrices gardées ; endpoint sitemap non borné supprimé. **Correctifs du 06/09 soir** : compte usine `test@example.com` (id 2, trouvé en prod, 0 donnée attachée) **neutralisé** (mot de passe aléatoire + email dévérifié) + garde d'environnement sur `DatabaseSeeder` ; **migration unicités** `payments.transaction_id` (idempotence webhooks) + `profiles.telegram_id` (0 doublon, jouée et vérifiée) ; fichier diagnostic `storage/health-check-0209.php` archivé dans `.agents/`.

**Reste (non bloquant)** : P2 — idempotence wishlist/panier (double-clic → 500) ; P3 — colonne générée `effective_price` indexée (perf), scans `LOWER(TRIM(title))` (perf), N+1 Scout (perf), counter cache `listing_count` (cohérence), évaluer `SameSite=Lax` au lieu de `none` (front et API sont même site), rotation de l'APP_KEY lors d'une fenêtre de maintenance (déconnexion globale), 2FA sur les comptes admin (optionnel).

## 🔵 Anti-scraping — ✅ couche Laravel active le 06/09 soir + couche Cloudflare à activer (propriétaire)

Décision propriétaire 06/09 : bloquer le scraping même avec rotation de proxies → deux étages.

**Laravel (fait, vérifié en live)** : `trustProxies` (plages Cloudflare publiques + sauts locaux Caddy/Apache, inline dans `bootstrap/app.php` — config() indisponible à ce stade, incident 2 min corrigé) → `Request::ip()` = vraie IP client ; limiter `catalogue` activé (`ANTI_SCRAPING_ENABLED=true`, 300 req/min/IP — couvre les bursts d'autocomplétion) **avec exemption du trafic interne** (SSR du front via le LAN + postes privés : jamais des visiteurs). Test : 310 requêtes parallèles → 246×429, fenêtre réinitialisée après 60 s. Limite connue : la rotation de proxies contourne un comptage par IP — d'où le 2ᵉ étage.

**Cloudflare (à activer par le propriétaire, ~5 min)** : (1) proxifier `livrezone.com` (orange cloud) — l'IP origin 41.251.35.31 est actuellement exposée ; SSL/TLS « Full (strict) » ; les WebSockets /app/* passent via CF ; (2) Security → Bots → **Bot Fight Mode** ON ; (3) Security → WAF → **Rate limiting rule** (1 gratuite) : URI Path starts with `/api/`, >100 req/min, Same IP → Block 10 min ; (4) option : règle WAF « Managed Challenge » sur /api/* si user_agent vide.

## 🟣 Priorité 3-bis — SEO catalogue 697k fiches — SEO-1 + SEO-2 ✅ livrés 06/09 soir (lz en attente)

Stratégie complète : `.agents/SEO-catalogue-697k-2026-09-06.md` (données mesurées : 100 % ISBN, 0 doublon, 90 % résumés → indexation massive justifiée type Goodreads/OpenLibrary). **Livrés** : sitemap index+chunks (`/sitemap.xml` = index, ~14 chunks de 50k livres + annonces + 47k éditeurs, API `SitemapController` paginée + cachée), canonical/308 des slugs books+annonces (`lib/book-slug.ts`), JSON-LD Book+Breadcrumb sur les fiches catalogue, « Du même rayon » (`/api/books/{id}/related`, cache 6 h), hubs `/books/editeurs` (+[slug], noindex < 3 livres), noindex des facettes /books. **R6 auteurs EXCLU** (décision propriétaire 06/09 : liste d'auteurs pas fiable — à re-étudier après nettoyage des données). Reste : **SEO-4 (P3)** suivi GSC + enrichissement des 35 690 fiches minimales.

## 🟡 Priorité 4 — Z7 : recette front notifications V2 (03/09, inchangée)

Tests manuels connectés (suite de la session 09-09).

## 🟡 Priorité 5 — Tier code (03/09 enrichi par l'audit, ~2-3 j)

Items 03/09 : Form Requests `OrderController`/`DashboardController`, extraire `ensureProfileExists`, middleware `EnsureActive`, centraliser map `Category::pluck`, neutraliser `dropIfExists` (→ Priorité 3), `trustProxies`.
Ajouts audit 06/09 :
- Transactions sur écritures critiques : `ChatController::sendMessage:153`, `PaymentController::store:99`, `NotificationController::clearBadges/bulk`, `AdminController::updateUserStatus:64` ; `firstOrCreate` sur `WishlistController::store:252` / `CartController::store:81`.
- Réindexation Meili `listings` après mass updates (admin/vendeur) + planifier un `scout:import Listing` quotidien (actuellement seul `Profile` est réindexé à 03:30).
- `SANCTUM_TOKEN_EXPIRATION`, throttle sur `/auth/reset-password`, `composer remove aws/aws-sdk-php`, `git rm` des débris racine (`nul`, `mapping.json`, `populate-authors-list-ephemere.php`, `storage/health-check-0209.php`).
- Contrainte unique `(user_id, book_id)` actif sur `orders` ; soft-delete des codes promo (compteur `times_used` faussé par le hard delete).
- Déploiement : `php artisan optimize` dans `lz`, tags d'images datés + procédure rollback, suppression `NODE_TLS_REJECT_UNAUTHORIZED=0` (`lz:47`, **après** avoir fait confiance au certificat local dans le conteneur), healthcheck conteneur.
- CI : APP_KEY via `secrets.APP_KEY` + **rotation de l'APP_KEY prod** (invalidation sessions) ; mesure de couverture nightly.
- Tests : suite `AuthTest` (login/register/reset/consent) + `TelegramWebhookTest` — domaine sensible à 0 % de couverture.

## 🟢 Priorité 6 — Migration `livrezone.com` / SSD dédié (03/09, après la bascule domaine)

État des lieux SSD → périmètre (code, conteneurs rootless, volumes, dumps MariaDB, Meilisearch, sauvegardes) → fenêtre de coupure + plan de rollback écrits AVANT (leçon incident 28/08) → DNS Cloudflare. Backup Drive fonctionnel = prérequis couvert. ⚠️ Re-vérifier la synchro `userpackage` OpenPanel (risque de réécriture des MemoryMax du slice — cause racine 524).

## 🟢 Priorité 7 — SES production access + DKIM (03/09, après migration SSD)

Propriétaire : demande production access (site `livrezone.com`) + 3 CNAME DKIM Cloudflare. Agent ensuite : `queue:retry 18`, test réel forgot-password, rotation creds SMTP, vérifier l'absence de `.aws.txt` (déjà absent, vérifié 06/09). Reprise : `.agents/PROMPT-SESSION-SES.txt`.

## 🔵 Moyen terme (1-3 mois) — dette structurante issue de l'audit 06/09

- ApiResources + contrat de réponse unique (payloads listings/orders d'abord).
- Enums PHP de statuts (`ListingStatus`, `OrderStatus`, `PaymentStatus`).
- Colonnes générées `effective_price` + `normalized_title` + index composites (cf. audit §5).
- Métier : modération appliquée à `DashboardController::updateInline` ; `RatingService` avec achat vérifié ; `applyVisibility()` avant pagination.
- Front : découpage `AdminClient` (1193 l.)/`DashboardClient`/`ListingForm`, `AbortController` (0 occurrence), `error.tsx`/`loading.tsx`, `dynamic()` sur les composants lourds, CSP.
- Observabilité : router `Log::critical` + watchdog vers Telegram (canal existant), uptime externe, Sentry.
- Staging minimal.

## ⚪ Long terme (3-6 mois)

- API `/v1` versionnée ; centralisation URLs complète (15 refs front restantes après migration).
- Paiement réel CMI/Fatourati (dès credentials) en remplaçant le stub `PaymentGatewayService`.
- Découpage monolithes restants, monitoring/alerting complet, centralisation URLs (P5 de l'audit 25/08).

---

# Historique

## Backlog validé — 03/09/2026 (décisions propriétaire) — SUPERSEDED par le backlog consolidé ci-dessus

Décisions du jour :
- **Base books : FINALISÉE** (Étape 2 close, retirée du backlog).
- **Backup quotidien Google Drive : ✅ FAIT ET FONCTIONNEL** (décision propriétaire 03/09 — Étape 0-bis close, la migration a son filet).
- **SES déplacé APRÈS la migration** : la demande de production access SES exige d'indiquer le site à Amazon → il faut que `livrezone.com` soit en production (DKIM CNAME Cloudflare rattachés au domaine final).
- **La migration du site vers `livrezone.com` (SSD dédié) redevient un chantier prioritaire**.

| Ordre | Chantier | Détails |
|---|---|---|
| 1 | **Finir le site** (Étape 1) | Parcours publics restants + manques produit (revue 29/08) |
| 2 | **Z7 — recette front notifications V2** | Tests manuels connectés (suite de la session 09-09) |
| 3 | **Tier code** (~1-2 h) | Form Requests `OrderController` (l.63, 95) + `DashboardController` (l.25, 47, 65, 152) ; extraire `ensureProfileExists` ; middleware `EnsureActive` (tokens Sanctum invalidés après désactivation) ; centraliser map `Category::pluck` dans `ReferenceFilterService` ; neutraliser `dropIfExists` de `rebuild_orders_table` ; `trustProxies` dans `bootstrap/app.php` |
| 4 | **Migration livrezone.com / SSD dédié** (point 6) | État des lieux SSD (taille, FS, montage) → périmètre (code, conteneurs rootless, volumes, dumps MariaDB, Meilisearch, sauvegardes) → **fenêtre de coupure + plan de rollback écrits AVANT exécution** (leçon incident Apache 28/08) → DNS Cloudflare. Rappel : config non cachée + bind mount, le code suit le dépôt git ; à traiter explicitement : `.env` (creds SMTP SES, `FRONTEND_URL`), données non versionnées. Backup Drive fonctionnel = prérequis couvert |
| 5 | **SES — production access + DKIM** (après migration) | Propriétaire : demande production access avec site `livrezone.com` + 3 CNAME DKIM Cloudflare. Agent ensuite : `queue:retry 18`, test réel forgot-password, rotation creds SMTP, suppression `.aws.txt` (exposé à la racine du bind mount). Reprise : `.agents/PROMPT-SESSION-SES.txt` |
| 6 | **Après bascule** | Stack marketing sur le nouveau stockage (n8n + Postiz + worker Python/IA) puis long terme (Étape 5) : API `/v1`, découpage monolithes front, monitoring/alerting, centralisation URLs (P5), CMI/Fatourati (dès credentials) |

## Fonctionnel en production (état 03/09)

- Auth Google OAuth (Sanctum + Socialite) + auth classique + consentement CGV post-OAuth
- Complétion de profil (villes, logo, nickname), dashboard listing complet (inline-edit, bulk-status, bulk-discount, republish)
- Annonces (SSR + SEO + filtres multi-critères), catalogue `/books` (Meilisearch exclusif), annuaire `/librairies`
- Notifications V2 (tri épinglé, hide/bulk/clear-badges, digest chat horaire, canaux mail/Telegram)
- Fiche user admin (désactivation → annonces `hidden`), fiche livre, recherche thèmes
- Backup quotidien Google Drive + test de restauration mensuel
