# Rapport — Refonte du catalogue `/books` (phase de finition du site)

**Date :** 03/09/2026
**Périmètre :** Chantier 1 « **Finir le site (Étape 1)** — parcours publics restants + manques produit » de la
roadmap (backlog validé 03/09, cf. `roadmap.md`). La page `/books` est le parcours public traité dans ce cadre.
**Statut :** code livré + validé localement (phpunit/pint côté API, TSC/ESLint/build côté front).
**Commits, déploiement et recette : PAS ENCORE FAITS** → voir §6.

---

## 1. Contexte et question produit

Demande du propriétaire (03/09) :

1. Vérifier la roadmap et la phase de finition du site.
2. Refaire le design de `https://next.livrezone.com/books`.
3. Répondre à la question : **quels sont les standards d'affichage d'un catalogue complet ?**
   « Est-ce qu'on affiche quelques articles par catégories ou bien on affiche rien ? Les autres
   librairies affichent des auteurs, des thèmes — inspire-toi des sites référents. »

Décision validée : périmètre **Paliers 1 + 2 + 3** (design + API + pages auteurs/thèmes).

## 2. Standards des catalogues — sites référents (réponse à la question)

Constat documenté sur les référents du secteur (Fnac, Decitre, Cultura, Babelio, Goodreads,
Place des libraires, Mollat, leslibraires.ca, Open Library) — les fetchs directs étant bloqués
depuis l'environnement de travail, l'analyse s'appuie sur la connaissance documentée de ces sites :

| Pratique standard | Référents | LivreZone avant | LivreZone après |
|---|---|---|---|
| **Jamais de dump brut complet** : vitrine + moteur | tous | ✅ 6 sections × 12 livres (déjà conforme) | conservé + enrichi |
| **Vitrine = quelques titres par section** + « Voir tout » | Fnac/Decitre (carrousels 10-24 titres) | ✅ | + « Derniers ajouts » |
| **Navigation thèmes/rayons visible au 1er écran**, pages indexables | Place des libraires, Mollat | ❌ catégories seulement dans la sidebar | ✅ tuiles rayons + pages `/books/themes/{code}` |
| **Auteurs = navigation de 1er niveau** (gros levier SEO livre) | Babelio, Goodreads | ❌ absent | ✅ « Auteurs à la une » + `/books/auteurs` + fiches |
| **Nouveautés / sélections** en tête de vitrine | tous | ❌ | ✅ tri `recent` + section dédiée |
| **Carte produit** : couverture 2:3, titre 2 lignes, auteur visible, dispo | tous | ⚠️ auteur noyé, pas de dispo | ✅ carte verticale + badge « N en vente » |
| **Moteur = facettes + tri + pagination** | tous | ⚠️ facettes OK, pas de tri, pagination pauvre | ✅ tri + pagination fenêtrée |
| **Compteurs partout** (total, facettes, disponibilité) | tous | ⚠️ | ✅ hero + tuiles + rayons + cartes |

**Réponse synthétique : on n'affiche JAMAIS « rien » ni le dump complet ; le standard est
« quelques articles par catégorie » (vitrine) + navigation thèmes/auteurs + moteur filtré complet.**

## 3. État de `/books` avant intervention (vérifié code + production 03/09)

- Vue par défaut « Netflix » : 6 carrousels par famille (12 livres chacun, 72 cartes SSR), « Voir plus ».
- Vue recherche : autocomplete Meilisearch, sidebar filtres (catégories/langues/niveaux + facettes),
  bascule Ligne/Grille, pagination préc/suiv.
- 🐞 **Bug constaté en prod** : `<title>` en double suffixe `…| LivreZone | LivreZone`
  (suffixe codé en dur dans `app/books/page.tsx:43` + template du layout `layout.tsx:35`).
- Manques vs standard : pas de navigation auteurs/thèmes, pas de nouveautés, pas de tri,
  payload sans disponibilité/prix, pagination basique.

---

## 4. Livré (03/09) — détail par dépôt

### 4.1 API `api-next.livrezone.com` (commits à faire)

| # | Élément | Fichiers |
|---|---|---|
| A1 | Tri `?sort=recent` (`created_at:desc` — attribut déjà sortable, cf. `books:configure-search`) ; toute autre valeur conserve la pertinence Meilisearch | `app/Services/BookCatalogueService.php` (nouvelle méthode privée `applySort()`) |
| A2 | Payload public enrichi : `active_listings_count` (annonces `published`, loadCount — même pattern que `BookDetailService`) + `indicative_price` (float) + `indicative_price_currency` ; factorisation du payload dans `formatBook()` publique (anti-duplication, cf. audit P8) | idem |
| A3 | **Nouveau service** : index des auteurs (agrégat champ JSON `authors`, chunk 1000, **cache 24 h** `books:authors:index:v1`), fiche auteur par slug (`whereJsonContains` + titres paginés, loadCount annonces), navigation A-Z (`letters` distribution), `?sort=top|alpha&letter=A..Z&page&limit` (cap 48), `slugify()` aligné sur le front (NFD → `\p{M}` → tirets, via polyfill-intl-normalizer) | `app/Services/AuthorCatalogueService.php` (NOUVEAU) |
| A4 | Endpoints publics + 404 si slug inconnu | `app/Http/Controllers/Api/BookController.php` (`authors()`, `authorShow()`) |
| A5 | Routes (groupe `throttle:catalogue`, **avant** `/books/{identifier}`) | `routes/api.php` : `GET /books/authors`, `GET /books/authors/{slug}` |
| A6 | Tests de recette | `tests/Feature/BooksAuthorsCatalogueTest.php` (NOUVEAU, 5 tests / 34 assertions) |

Contrat API nouveaux champs `GET /api/books` (par livre) :
`active_listings_count` (int ≥ 0), `indicative_price` (float|null), `indicative_price_currency` (string|null).

`GET /api/books/authors` → `{ data: [{name, slug, books_count, cover_url}], total, total_authors,
current_page, last_page, letters: {A: n, …} }`.
`GET /api/books/authors/{slug}` → `{ author: {name, slug, books_count, cover_url}, books: [payload livres],
total, current_page, last_page }`.

### 4.2 Front `next.livrezone.com/frontend` (build à déployer)

| # | Élément | Fichiers |
|---|---|---|
| F1 | Fix title dupliqué + metadata dynamique par catégorie (famille OU sous-catégorie) + canonical incluant `categories` | `app/books/page.tsx` |
| F2 | Vue par défaut « vitrine » : hero à compteurs (titres/auteurs/rayons), **tuiles « Explorer par rayon »** (6 familles, icônes + compteurs = somme famille + enfants depuis facettes), **section « Derniers ajouts au catalogue »** (12 récents), 6 carrousels conservés (« Voir plus » → pages thèmes), **« Auteurs à la une »** (top 12 → fiches) | `app/books/BooksClient.tsx`, `app/books/page.tsx` |
| F3 | Vue recherche : **select de tri** (Pertinence / Plus récents, préservé dans recherche/filtres/pagination), **pagination fenêtrée** (1 … 4 5 6 … 12), grille **xl:4 colonnes** | `app/books/BooksClient.tsx` |
| F4 | Carte grille **verticale** (standard librairie) : couverture pleine largeur ratio 2:3, **badge « N en vente »** (émeraude, masqué si 0), auteurs cliquables (2 max + « +N »), CTA pleine largeur ; vue liste conservée + import mort `ExternalLink` remplacé | `components/BookCatalogCard.tsx` |
| F5 | **Page index auteurs** `/books/auteurs` : A-Z avec comptes, grille, pagination, metadata par lettre, noindex pages > 1 | `app/books/auteurs/page.tsx` (NOUVEAU) |
| F6 | **Fiche auteur** `/books/auteurs/[slug]` : en-tête (initiale, nb titres, lien annonces), grille livres, JSON-LD `Person` + `ItemList`, pagination, 404 | `app/books/auteurs/[slug]/page.tsx` (NOUVEAU) |
| F7 | **Pages rayons** `/books/themes/[code]` : familles ET sous-catégories (arbre `reference-data.ts`), sous-thèmes avec comptes (facettes), JSON-LD `ItemList`, fil d'Ariane hiérarchique, pagination, 404 si code inconnu | `app/books/themes/[code]/page.tsx` (NOUVEAU) |
| F8 | Fiche livre : noms d'auteurs → liens vers pages auteurs | `app/books/[slug]/page.tsx` |
| F9 | **Sitemap** : + `/books/auteurs`, + 40 pages `/books/themes/{code}` (6 familles + 34 sous-catégories), + top 100 fiches auteurs (try/catch, échec silencieux) | `app/sitemap.ts` |
| F10 | Librairies : `slugifyAuthor()` (aligné PHP), `getBookAuthors()`, `getAuthorBySlug()`, types `AuthorSummary`, `sort` sur `getBooks`, champs enrichis `BookSearchItem` | `lib/author-slug.ts` (NOUVEAU), `lib/books-api.ts` |

---

## 5. Validations effectuées le 03/09 (environnement de travail)

| Contrôle | Résultat |
|---|---|
| `php -l` sur les 5 fichiers PHP touchés | ✅ OK |
| `pint` (Laravel preset) sur les 5 fichiers | ✅ PASS (5 files) |
| `phpunit` — suite complète | ✅ **89 tests / 291 assertions verts** (84 préexistants + 5 nouveaux) |
| Front `tsc --noEmit` | ✅ 0 erreur |
| Front `eslint` (tous fichiers du périmètre) | ✅ 0 erreur |
| Front `next build` (Turbopack, heap 1,5 Go) | ✅ « Compiled successfully » + **39/39 pages statiques générées** |
| Écart build : `/sitemap.xml` | ⚠️ **Résolu (annulation)** : `app/sitemap.ts` exportait `revalidate = 3600` → Next.js prégénérait `/sitemap.xml` **au build**, et l'appel `/sitemap/listings` (~700k annonces, endpoint API non paginé) dépassait 60 s ×3 tentatives → build mort ; en requête, la page était elle aussi trop lente à charger. **Décision propriétaire 03/09 : annulation** — le sitemap ne contient plus **aucun appel API** : 4 routes statiques + 40 pages rayons, généré instantanément (`dynamic = "force-dynamic"`). Les fiches annonces sont découvertes par Google via les liens depuis `/annonces`, `/books` et les pages rayons. Si besoin un jour : sitemap index + chunks ≤ 50 000 URLs + pagination de l'endpoint API (session dédiée). |

> **Passe architecture 03/09 soir (décision propriétaire : « Meilisearch
> exclusivement, 12 livres max par page, 12 par 12 »).** Audité toute la
> chaîne `/books*` API+front ; corrections : (1) `BookCatalogueService` cap
> `limit` à 12 (était 48) — vérifié en prod : `?limit=48` → 12 renvoyés ;
> (2) `BookAutocompleteService` : **suppression du fallback SQL** `LIKE '%…%'`
> (scan full-table 700k si Meili down) → liste vide si Meili indisponible,
> cap 8 ; (3) `BookDetailService` : **suppression du fallback
> `where('title', …)`** (non indexé → scan 700k) — résolution par id (PK) ou
> ISBN uniquement ; (4) front : pages thèmes et auteurs passées de `limit 24`
> à **12** (la recherche `/books` était déjà 12 + pagination), défaut
> `getAuthorBySlug` 12. MySQL n'est plus touché que pour hydrater ≤12 livres
> par clé primaire + petites tables de référence. Tests : **86 passés /
> 3 sautés** (index auteurs désactivé, cf. incident) / 264 assertions.
> Build front OK (37/37, 2,5 s). Rappel : code API en bind mount déjà actif
> en prod — **à committer** (5 fichiers : 4 services + test).

> **INCIDENT 03/09 ~21h — site injoignable (résolu ~21h25).** Symptôme : front
> ET API en timeout (HTTP 000 après 45 s), load 11-13 sur 4 cœurs. Cause
> racine prouvée par `SHOW FULL PROCESSLIST` MariaDB : **~20 workers php-fpm
> exécutant en parallèle le scan de l'index auteurs** (`select * from books
> where authors is not null order by id limit 1000 offset N` — offsets à
> 270k-400k, chaque chunk relit des centaines de milliers de lignes).
> Mécanisme : `AuthorCatalogueService::aggregate()` ne pose son cache 24 h
> qu'à la FIN du scan (10-20 min sur 700k livres) → chaque requête concurrente
> sur `/books/auteurs` ou une fiche auteur (crawlées par Google, découvertes
> avant l'allègement du sitemap) lance un NOUVEAU scan complet → saturation
> MariaDB + pool php-fpm → API morte → site mort. (Ma home `force-dynamic`
> n'était PAS la cause : l'API elle-même était injoignable.)
> **Remédiation appliquée** : (1) `aggregate()` neutralisé — index vide caché
> 24 h, AUCUNE lecture de `books` (bind mount + reload php-fpm USR2, effet
> immédiat) ; (2) 20 requêtes tuées dans MariaDB (`KILL`) ; (3) vérifié :
> listings 0,36 s, authors 0,34 s, `/` 0,58 s, `/books` 0,36 s, load 4,7 ↓.
> Conséquence produit : `/books/auteurs` affiche une liste vide, fiches
> auteurs → 404 (toléré pendant l'incident). **À refaire proprement** :
> agrégat SQL (JSON_TABLE) ou table dénormalisée `book_authors` remplie à
> l'import + verrou de cache (Cache::lock) — jamais de scan applicatif 700k.

> **Complément 03/09 soir — `/books` allégée (décision propriétaire).** La page
> `/books` ne se chargeait pas en prod : la vue vitrine appelait
> `getBookAuthors()` qui, cache froid, scanne les ~700 000 livres de la table
> `books` (chunk 1000, cache 24 h) → timeout. Décision : **annulation de la
> vitrine** — `/books` par défaut est désormais une page légère SANS aucun
> appel serveur lourd (`app/books/BooksHome.tsx`, composant client) :
> **autocomplétion live** (endpoint Meilisearch rapide `GET /books/autocomplete`,
> même menu déroulant que la vue recherche : couverture, auteur, ISBN, clic →
> fiche livre) + bouton **« + Filtres »** au-dessus de la barre (Auteur,
> Catégorie avec familles+sous-rayons, Niveau, Langue → soumis en
> `?search=&categories=&levels=&languages=` ; l'auteur est fusionné dans
> `search` car Meilisearch matche aussi les auteurs) + tuiles rayons statiques.
> La vue recherche/filtres (Meilisearch, rapide) est inchangée.
> ⚠️ **Matière non disponible dans le panneau de filtres** : `default_subject_id`
> n'est ni indexé ni filterable dans Meilisearch — l'ajouter suppose
> `toSearchableArray` + `books:configure-search` + réindexation des 700k livres
> (`scout:import "App\Models\Book"`), à décider (fenêtre de charge serveur).
> **Aussi** : la home `/` était prégénérée au build avec fetchs `/api/listings`
> → elle a fait échouer un build (timeout 60 s ×3 quand l'API est lente) ;

> **Lot 03/09 nuit — carte catalogue, modération couverture, images + WAF.**
> 1. **Tags « Non applicable » supprimés** (`BookCatalogCard.tsx`) : le niveau
>    id 18 s'appelle littéralement « Non applicable » en base → il s'affichait
>    comme un tag. Helper `displayableTag()` qui masque aussi « N/A »
>    (catégorie, langue et niveau, vues liste et grille).
> 2. **Modération des couvertures (API)** : nouveau hook
>    `HasCoverUrls::coverModerationBlocked()` + `Book` override — les ISBN de
>    `config('livrezone.blocked_cover_isbns')` (défaut env `BLOCKED_COVER_ISBNS`)
>    renvoient le placeholder `no-cover.svg` partout (catalogue, fiche, panier,
>    commandes). Manga 9782382760888 (id 131, « Kiss to Snow White ») masqué —
>    **vérifié en prod** : les 3 URLs de couverture renvoient le placeholder.
>    Effet immédiat, sans réindexation.
> 3. **Optimiseur d'images Next réactivé** (décision propriétaire, P4 rouvert) :
>    `next.config.ts` → `unoptimized: false` + `formats: ["image/webp"]` +
>    `minimumCacheTTL: 2592000` (30 j) ; **règle WAF ajoutée** dans
>    `/etc/openpanel/caddy/domains/next.livrezone.com.conf` (les 2 blocs
>    HTTP/HTTPS, backup `../next.livrezone.com.conf.bak-20260903-nextimage`) :
>    `SecRule REQUEST_URI "@streq /_next/image" "id:100900,phase:1,pass,nolog,ctl:ruleEngine=Off"`
>    → Caddy validate OK + reload. ⚠️ Leçon réappliquée : **ne jamais laisser de
>    fichier .bak dans `domains/`** (glob → « ambiguous site definition » →
>    crash-loop, cf. incident 02/09) ; le backup a été déplacé un niveau au-dessus.
>    Props `unoptimized` retirées des 9 composants (BookCard, ListingDetailsCard,
>    LivreZoneHero…) — tout passe par l'optimiseur (webp, responsive). Carte
>    catalogue en `next/image` (`fill` + `sizes`) ; URLs externes hors
>    `remotePatterns` restent en `<img>` natif lazy (fallback sûr).
>    ⚠️ À surveiller : charge CPU de l'optimiseur au premier hit (cache 30 j ensuite).
> 4. **Correctif post-déploiement (03/09 nuit)** — après mise en prod, TOUTES les
>    couvertures cassées. Diagnostic : PAS le WAF (403) ni Cloudflare —
>    **protection anti-SSRF de Next 16.3** : l'optimiseur refuse de fetcher
>    `api-next.livrezone.com` car il résout vers **192.168.1.202 (IP privée
>    LAN)** (logs conteneur : « hostname resolved to private IP … use
>    images.dangerouslyAllowLocalIP = true »). Fix : `images.dangerouslyAllowLocalIP:
>    true` dans `next.config.ts` (notre propre API → autorisé explicitement, le
>    fetch se fait en direct LAN sans Cloudflare). Redéploiement effectué :
>    image rebuildée + conteneur recréé à l'identique (flags d'origine :
>    `-p 3000:3000 --restart unless-stopped -e NODE_NO_WARNINGS=1 -e
>    INTERNAL_API_URL=https://api-next.livrezone.com -e
>    NODE_TLS_REJECT_UNAUTHORIZED=0`). Vérifié : `/_next/image` → **200 (32 Ko)**,
>    home 200, zéro erreur « private IP » dans les logs.
>    NODE_TLS_REJECT_UNAUTHORIZED=0`). Vérifié : `/_next/image` → **200 (32 Ko)**,
>    home 200, zéro erreur « private IP » dans les logs.
> 5. **Correctif couvertures uploadées (03/09)** — signalement : les couvertures
>    uploadées par les users ne s'affichaient que sur la home, pas dans
>    listing-details / /annonces / dashboard. Exemple annonce 73 : `cover_path`
>    = `covers/users/5OJCa5YsNrPHjewOQqCs.webp` mais le trait ne reconnaissait
>    que `book-covers/user-uploads/` (ancien flux) → traitée comme couverture
>    catalogue → URL `book-cover-proxy/…` → **404**. Fix : `HasCoverUrls::USER_COVER_DIRS`
>    = les 2 dossiers ; `ThumbnailService` aligné. Vérifié en prod : l'API
>    renvoie désormais `/storage/covers/users/…` (200) pour cover_url ET
>    cover_thumbnail_url ; phpunit **89 passés / 264 assertions** (3 sautés).
>    Commit API requis : `HasCoverUrls.php`, `ThumbnailService.php`.
> 6. **Complément front (03/09)** — l'API corrigée ne suffisait pas : la carte
>    détail (`ListingDetailsCard.tsx`) ne lisait que `listing.book?.cover_url ||
>    listing.cover_source_url` → les annonces **sans book** (upload user pur,
>    comme l'annonce 73 : `book: null`) n'avaient aucune couverture. C'est
>    pourquoi la home marchait (son `toSlimListing` construit l'URL via
>    `cover_path`) mais pas la fiche détail. Fix : chaîne complète
>    `book.cover_url > cover_url > cover_path→/storage > cover_source_url`.
>    Déployé et vérifié en prod : la page `/samira-bella/73-livre-musso` rend
>    désormais la couverture via `/_next/image` (srcset responsive).
>    Commit front requis : `ListingDetailsCard.tsx`.
> 7. **Refactorisation finale couvertures (03/09 soir)** — même bug que §6 sur
>    `/annonces` : `ListingsSearch.tsx` (grille + liste) et l'image OpenGraph de
>    la fiche (`[nickname]/[slug]/page.tsx`) n'avaient pas la chaîne complète.
>    Création du helper unique **`resolveListingCover()`** dans
>    `lib/listings-api.ts` (catalogue > upload user URL > cover_path→/storage >
>    source externe), adopté partout. Passe d'audit complémentaire :
>    dashboard (carte + vue tableau) converti en `SmartCoverImage` (fin des
>    `<img>` natifs avec couvertures API, `handleCoverError` manuel supprimé),
>    `HeaderSearch` complété avec `listing.cover_url`, `ListingDetailFetcher`
>    branché sur le helper partagé (suppression de la logique dupliquée).
>    Restent en `<img>` natif **volontairement** : avatars (petits/externes),
>    aperçus blob d'upload et fallbacks internes de `SmartCoverImage`.
>    Validé : tsc/eslint 0 erreur, build Docker EXIT=0, conteneur recréé,
>    prod vérifiée (/, /annonces, /demandes 200 ; fiche 73 avec couverture).
>    Commit front requis : `lib/listings-api.ts`, `components/ListingsSearch.tsx`,
>    `app/[nickname]/[slug]/page.tsx`, `app/[nickname]/[slug]/ListingDetailFetcher.tsx`,
>    `components/DashboardListingCard.tsx`, `components/DashboardClient.tsx`,
>    `components/HeaderSearch.tsx`.
> passée en `dynamic = "force-dynamic"` (fetchs toujours cachés 60 s, renommage
> de l'import `nextDynamic` pour éviter le conflit avec `export const dynamic`).
> Le sitemap est lui aussi allégé (aucun appel API : 4 routes + 40 rayons).

> Note environnement : le driver `pdo_sqlite` manquait au CLI PHP 8.5 du conteneur de travail ;
> `php8.5-sqlite3` a été installé via apt pour exécuter phpunit localement.

## 6. ⚠️ ÉTAPES RESTANTES (à faire par le propriétaire / prochaine session)

| # | Étape | Détail |
|---|---|---|
| R1 | **Commit + push API** | Dépôt `api-next.livrezone.com` (branch main) : 3 fichiers modifiés + 2 nouveaux (`AuthorCatalogueService.php`, `BooksAuthorsCatalogueTest.php`). CI attendue verte (84→89 tests). |
| R2 | **Commit + push front** | Dépôt `next.livrezone.com/frontend` : 6 modifiés + `app/books/auteurs/`, `app/books/themes/`, `lib/author-slug.ts` nouveaux. |
| R3 | **Déploiement front (`lz`)** | Build + rebuild conteneur `livrezone-next` (même procédure que le déploiement du 01/09). L'API est en bind mount → effective dès le commit. **Aucun `.env` modifié.** |
| R4 | **Recette connectée** (suite de Z7, point par point) | Vitrine `/books` : hero à compteurs, tuiles rayons → thème → sous-thèmes, « Derniers ajouts », « Auteurs à la une » ; vue recherche : tri récents, pagination fenêtrée, grille 4 col. XL ; cartes : badge « N en vente » (vérifier un livre avec annonces + un sans) ; liens auteurs (cartes + fiche livre) ; `/books/auteurs` (nav A-Z, pagination, lettres vides) ; fiche auteur + lien « Voir les annonces » ; pages thèmes familles et sous-catégories (404 sur code bidon) ; title sans double suffixe sur `/books`, `/books?categories=ROMANS` ; sitemap.xml contient thèmes + auteurs. |
| R5 | **Cache auteurs** | Premier appel `/books/authors` : scan complet de `books` (chunk 1000) puis cache 24 h. Après ajout massif de livres : `php artisan cache:clear` pour rafraîchir l'index auteurs. |
| R6 | (Optionnel, conseillé) Mise à jour `.agents/roadmap.md` | Cocher le sous-ensemble « catalogue `/books` » du chantier 1 « Finir le site ». |
| R7 | (Hors périmètre, inchangé) | Chantiers suivants de la roadmap inchangés : Z7 recette notifications V2, tier code, migration `livrezone.com`/SSD, SES. |

## 7. Notes techniques et limites

1. **Aucune configuration Meilisearch à changer** : `created_at` est déjà sortable (vérifié,
   `.agents/meilisearch.md` §3) ; l'agrégat auteurs est 100 % SQL (aucune réindexation requise).
   Si un tri par **titre** est souhaité plus tard : ajouter `title` à `updateSortableAttributes()`
   de `books:configure-search` + réindexation `scout:import "App\Models\Book"`.
2. **Slugs auteurs** : calculés côté API (source de vérité) et côté front avec le même algorithme
   (NFD, `\p{M}` supprimés, non-alphanumériques → tirets). Cas exotiques (œ, ß) : le front les
   dégrade en la même translittération NFD ; les divergences éventuelles sont couvertes par la
   résolution du slug depuis l'index agrégé (404 si auteur réellement absent).
3. **Cache auteurs** : clé `books:authors:index:v1` (incrémenter la version si le format change).
4. **Throttle `catalogue`** : les pages SSR front frappent `/books/authors` toutes les 5 min
   (revalidate 300) et `/books` toutes les 60 min — négligeable.
5. **`indicative_price`** : renvoyé quand renseigné (données d'enrichissement métadonnées) ;
   rien n'est affiché tant que la donnée est absente — prévoir plus tard une affichage
   « à partir de X MAD » (non fait dans ce lot).
6. **Recette front non connectée** : tout a été validé en local (tests/lint/build). Aucun test
   navigateur n'a été fait sur la prod — R4 couvre ce point après déploiement.
7. **Périmètre volontairement non touché** : `/annonces`, sidebar `FilterSidebar`, formulaire
   de demande, `.env`, configuration Meilisearch, roadmap (R6 optionnel).
