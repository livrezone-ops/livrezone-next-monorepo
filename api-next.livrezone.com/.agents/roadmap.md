# Roadmap LivreZone — Session 4 & 5 (14/08/2026)

## Fonctionnel en production

- Auth Google OAuth (Sanctum + Socialite)
- Complétion de profil (villes, logo, nickname)
- Dashboard listing : liste, inline-edit, update status (sold/deleted/archived), republish, bulk-status, bulk-discount
- Création d'annonce (formulaire complet + recherche ISBN)
- Édition d'annonce (photo, ISBN, PUT)
- Listing detail public (client-side, TanStack Query, policy par statut)
- Messages Toast (hook useToasts)
- Quantité forcée à 1, validation backend catégorie/niveau/matière

## Welcome page (accueil public SEO) — FAIT, DÉPLOYÉ (autre session)

- Hero carrousel dynamique (mur éditorial de couvertures, messages JSON fr/ar, RTL, auto-play)
- 7 grilles horizontales (récemment ajoutés, scolaire, romans, mangas & BD, jeunesse, universitaire, religion)
- Bannière vente + section « Pourquoi LivreZone » (scroll horizontal sur mobile)
- Titres SEO (H1 unique visible, H2 par section, métas, JSON-LD)
- Messages hero configurable via `data/hero-messages.json` (préparé pour migration table Laravel)
- Nombre de couvertures du hero configurable via `.env` (`HERO_COVERS_NUMBER_PER_SECTION`)

## Annonces page — FAIT (commit `d1952cb`), À DÉPLOYER

- SSR + SEO : `generateMetadata` par filtre (title/description/OG uniques), `canonical` normalisé, `noindex, follow` hors page 1, JSON-LD BreadcrumbList + ItemList.
- Sidebar `FilterSidebar.tsx` : portage de `filter-sidebar.blade.php` — Catégories (arbre), Langues, Niveau (par cycles : primaire/collège/lycée pour scolaire, universitaire/professionnel pour univ, tous les cycles au démarrage), État, Ville (menu déroulant multi-sélection), Prix (double slider), Appliquer/Effacer, drawer mobile.
- Filtres API multi-critères : catégories, niveaux, langues, états, villes (`city=1,2`), prix de vente (`COALESCE(discount_price, price)`), bornes `price_min`/`price_max` dynamiques. Compatibilité params historiques (`c`, `l`, `lvl`, `cond`, `min`, `max`).
- Prix : filtre sur le **prix de vente effectif**, slider avec **max dynamique**.
- Recherche : barre `/annonces` **réactive** à la saisie (debounce), recherche **sans la description** (titre, ISBN, auteur, éditeur).
- Header : recherche vers « Livres en vente » (`/annonces?search=`) ou « Base des livres » (`/livres?search=`), placeholder « Rechercher par ISBN, titre ou auteur ».
- Catalogue livres : page `/livres` (SSR + SEO) sur la table `books` via `GET /api/books` (recherche titre, ISBN, éditeur, auteur), lien « Voir les annonces de ce livre ».
- Layout historique : fil d'Ariane, H1 « Annonces », compteur, tri, bascule grille/liste, pagination chiffrée.
- Fix bug : URL client `…/api/api/listings` (404 → mockups) → normalisation base + adoption SSR, fallback mock supprimé.

## Backlog validé — 03/09/2026 (décisions propriétaire)

Décisions du jour :
- **Base books : FINALISÉE** (Étape 2 close, retirée du backlog).
- **SES déplacé APRÈS la migration** : la demande de production access SES exige d'indiquer le site à Amazon → il faut que `livrezone.com` soit en production (DKIM CNAME Cloudflare rattachés au domaine final).
- **La migration du site vers `livrezone.com` (SSD dédié) redevient un chantier prioritaire**, avec le backup Google Drive en prérequis.

| Ordre | Chantier | Détails |
|---|---|---|
| 1 | **Finir le site** (Étape 1) | Parcours publics restants + manques produit (revue 29/08) |
| 2 | **Z7 — recette front notifications V2** | Tests manuels connectés (suite de la session 09-09) |
| 3 | **Tier code** (~1-2 h) | Form Requests `OrderController` (l.63, 95) + `DashboardController` (l.25, 47, 65, 152) ; extraire `ensureProfileExists` ; middleware `EnsureActive` (tokens Sanctum invalidés après désactivation) ; centraliser map `Category::pluck` dans `ReferenceFilterService` ; neutraliser `dropIfExists` de `rebuild_orders_table` ; `trustProxies` dans `bootstrap/app.php` |
| 4 | **Étape 0-bis — Backup quotidien Google Drive** (~1 h) | ⚠️ Prérequis de la migration. `rclone` + cron : dump MariaDB gzippé (priorité vitale), code + `.env`, `storage/` (couvertures), snapshot Meilisearch (654 k docs), one-shot `/home/ouahib/lz-backups/`. Script `lz-backup-daily.sh`, rétention Drive 30 j, alerte Telegram en cas d'échec, test de restauration mensuel |
| 5 | **Migration livrezone.com / SSD dédié** (point 6) | État des lieux SSD (taille, FS, montage) → périmètre (code, conteneurs rootless, volumes, dumps MariaDB, Meilisearch, sauvegardes) → **fenêtre de coupure + plan de rollback écrits AVANT exécution** (leçon incident Apache 28/08) → DNS Cloudflare. Rappel : config non cachée + bind mount, le code suit le dépôt git ; à traiter explicitement : `.env` (creds SMTP SES, `FRONTEND_URL`), données non versionnées |
| 6 | **SES — production access + DKIM** (après migration) | Propriétaire : demande production access avec site `livrezone.com` + 3 CNAME DKIM Cloudflare. Agent ensuite : `queue:retry 18`, test réel forgot-password, rotation creds SMTP, suppression `.aws.txt` (exposé à la racine du bind mount). Reprise : `.agents/PROMPT-SESSION-SES.txt` |
| 7 | **Après bascule** | Stack marketing sur le nouveau stockage (n8n + Postiz + worker Python/IA) puis long terme (Étape 5) : API `/v1`, découpage monolithes front, monitoring/alerting, centralisation URLs (P5), CMI/Fatourati (dès credentials) |

## Prochaines sessions (historique 14/08 — périmètre largement traité depuis)

| Priorité | Sujet | Notes |
|---|---|---|
| Haute | Déployer page annonces + welcome page | Build + rebuild conteneur `livrezone-next` (annonces commit `d1952cb`) |
| Haute | Route [login] not defined | Middleware Authenticate → retour JSON 401 |
| Moyenne | Profil / Bibliothèque | Page publique vendeur + bibliothèque dashboard |
| Moyenne | Hero messages via API Laravel | Remplacer `hero-messages.json` par une table + endpoint |
| Faible | Couvertures uniformes | public_path vs Storage |
| Faible | Tri avancé / facettes | Sidebar filtres dashboard |
| Faible | Seeders | Cohérence nouvelle base |
| Faible | Détection ville par IP | Retirée (garder le filtre ville) ; réactivable via Cloudflare/`cf-ipcountry` si besoin |