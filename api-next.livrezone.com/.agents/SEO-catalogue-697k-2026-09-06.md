# Stratégie SEO catalogue 697k fiches — 2026-09-06 (ZCode, rôle SEO Lead)

Principe directeur validé propriétaire : **privilégier la découvrabilité et la couverture du
catalogue avant l'optimisation agressive du crawl budget**. Modèle de référence : Goodreads /
OpenLibrary (fiche bibliographique = valeur en soi), pas Amazon offres-only.

## 1. Données réelles du catalogue (mesurées 06/09 en base)

| Métrique | Valeur | Lecture SEO |
|---|---|---|
| Fiches livres | 697 172 | — |
| ISBN-13 présent | **100 %** | chaque fiche est une entité bibliographique identifiable |
| Doublons ISBN-13 | **0** | chaque fiche = une édition unique → **indexation massive justifiée** |
| Auteurs | 76,4 % | 164k fiches sans auteur |
| Éditeur | 99,9 % | **46 933 éditeurs distincts** |
| Résumé | 90,0 % | |
| Couverture | 92,0 % | |
| Date de publication | 83,7 % | |
| Nombre de pages | 12,2 % | faible mais non bloquant |
| Éditions multiples (même titre+éditeur) | 15 585 groupes | **pas des doublons** : ISBN distincts = éditions distinctes (poche, réédition) — légitimes à indexer comme Goodreads |
| Fiches avec annonces actives | 50 | 99,99 % des fiches ont 0 annonce — modèle « catalogue d'abord » |
| Fiches minimales (sans auteur NI résumé) | 35 690 (5,1 %) | restent indexables (titre+ISBN+éditeur+couverture), à enrichir en continu |

## 2. Verdict d'indexation (mission 1-3)

**Politique : indexation par défaut de 100 % des fiches résolues.** Une fiche mérite l'indexation
dès qu'elle a un ISBN + un titre — c'est le cas de 100 % du catalogue. Les signaux riches
(résumé 90 %, couverture 92 %) placent LivreZone au niveau de qualité documentaire d'OpenLibrary.

**Seuls cas de non-indexation autorisés :**

| Cas | Traitement | Volume |
|---|---|---|
| Page inexistante (id invalide) | 404 correcte (déjà le cas via `notFound()`) | — |
| Erreur technique (5xx, API down) | 404/5xx — jamais de 200 vide | — |
| Doublon réel | **Aucun détecté** (0 doublon ISBN) | 0 |
| Fiche minimale | **Indexable quand même** (principe directeur), enrichissement prioritaire | 35 690 |

Interdits qui tueraient la couverture : noindex des fiches sans annonce (99,99 % du catalogue !),
noindex des paginations, noindex des éditions multiples.

**Chantier technique lié (P1) : l'espace d'URLs libre.** `/books/{slug}` résout sur le premier
segment (id) et ignore le reste : `/books/42-xkjhh` renvoie 200. Deux protections :
canonical auto vers le slug canonique `/{id}-{isbn}-{titre-slugifié}` construit depuis les
données du livre (pas depuis l'URL demandée), puis 301 quand le slug demandé ≠ canonique.

## 3. Recommandations

### R1 — Sitemaps XML splittés (P1 — le levier n°1 de couverture)

Sitemap index + chunks via `generateSitemaps` de Next.js : 1 fichier pages+rayons (43 URLs),
1 fichier annonces (paginé, prêt pour la croissance), ~14 chunks livres de 50 000
(`/api/books` paginé par intervalles d'`id` — `WHERE id BETWEEN`, stable et indexable, pas de
COUNT ; cache 24 h ; lastmod = `updated_at` réel pour un re-crawl sélectif). Index de sitemap
servi par une route dédiée, déclaré dans robots.txt + GSC.

- **Gain SEO** : couverture de découverte de 43 → 697k+ URLs ; les fiches longues traîne (la
  masse) deviennent découvrables sans dépendre du crawling.
- **Indexation** : c'est le déclencheur — sans lui, Google ne voit que ~50 fiches.
- **Crawl budget** : Google ralentira de lui-même sur un catalogue neuf (« Découvertes, non
  indexées » pendant des semaines) — attendu, pas un problème.
- **Risque** : charge DB à la génération → mitigé par cache 24 h + intervalles d'id indexés.
  Déploiement front (`lz`) requis.

### R2 — Canonical + 301 de normalisation des slugs (P1, rapide)

`generateMetadata` de `app/books/[slug]/page.tsx` : canonical construit depuis les données
(book.id + isbn + titre slugifié) au lieu du slug demandé ; 301 vers le canonique si mismatch.
Idem fiches annonces.

- **Gain** : un seul URL par fiche dans l'index, signaux consolidés.
- **Indexation** : évite la dilution de doublons artificiels (spam de slugs).
- **Crawl budget** : économise le crawl des variantes infinies.
- **Risque** : nul — comportement standard. Front (`lz`).

### R3 — Données structurées Schema.org (P1 — levier n°1 de qualité d'affichage)

Fiches livres : JSON-LD `Book` (name, isbn, author[], publisher, datePublished, numberOfPages,
inLanguage, image, description, url) + `BreadcrumbList` ; ajouter `Offer` (prix MAD,
availability) uniquement quand des annonces existent. Pages rayons : `ItemList` (déjà en place
via safe-json-ld) à compléter. Accueil : `WebSite` + `SearchAction`. Émission via
`lib/safe-json-ld.ts` existant (échappement déjà sécurisé audit S5).

- **Gain** : éligibilité résultats enrichis, liaison entités (auteurs/éditeurs), meilleure
  compréhension sémantique du catalogue = meilleur matching requêtes longue traîne.
- **Indexation** : renforce la qualification des fiches (les fiches minimales gagnent un
  signal de structure).
- **Crawl budget** : neutre (même HTML).
- **Risque** : faible — ne pas implémenter `aggregateRating` sans vrais avis (penalité
  possible). Front (`lz`).

### R4 — Maillage horizontal « livres similaires » (P2 — le pattern Amazon)

6-8 liens « Du même rayon / Du même auteur » en bas de chaque fiche, via Meili
(`filter: default_category_id = X AND NOT id = Y`, tri par présence de couverture/description).
697k pages × 6 liens = graphe interne massif qui distribue le PageRank vers la longue traîne.

- **Gain** : accélérateur d'indexation par crawling (complète le sitemap) + pertinence
  thématique + engagement utilisateur.
- **Indexation** : réduit la profondeur de crawl de toutes les fiches.
- **Crawl budget** : oriente le crawl vers les fiches — c'est le bon usage du budget.
- **Risque** : charge Meili par vue → cache 1-6 h par livre. Front + API.

### R5 — Pages éditeurs (P2 — 46 933 hubs longue traîne)

`/books/editeurs/{slug}` SSR, alimenté par Meili (`filter: publisher = "..."`), pagination
HTML, liste par famille de rayon. Quasi tout le champ est rempli (99,9 %).

- **Gain** : 47k pages hubs sur des requêtes « livres [éditeur] » + maillage par éditeur.
- **Indexation** : nouvelle classe d'URLs à faible concurrence.
- **Crawl budget** : 47k URLs de plus — cohérent avec le principe directeur.
- **Risque** : pages fines si éditeur a 1-2 livres → noindex si < 3 livres (seuil simple).

### R6 — Pages auteurs : reconstruire (P2 — revisite de la décision du 04/09)

Les fiches auteurs avaient été supprimées (incident MariaDB du 03/09, décision de prudence :
301 vers la recherche). À reconstruire maintenant que le serveur est stabilisé :
`/books/auteurs/{slug}` SSR via Meili (champ `authors` searchable/filterable), hub paginé,
bibliographie par rayon. Les 301 existantes pointent alors vers les nouvelles pages.
~500k fiches avec auteurs ; chaque page auteur = landing « livres de X ».

- **Gain** : la plus grosse classe de hubs longue traîne du catalogue (nom d'auteur =
  requête à forte intention).
- **Indexation** : hubs qui maillent des dizaines/centaines de fiches à chaque fois.
- **Crawl budget** : coût proportionnel au nombre d'auteurs — mitiger par le seuil < 3 livres.
- **Risque** : c'est ce contenu qui avait aggravé l'incident 03/09 — implémentation cachée
  (Meili, pas de LIKE SQL) et cache obligatoires. Front + API.

### R7 — Rayons : hubs canoniques, facettes non indexées (P2)

Les 40 pages `/books/themes/{code}` restent les seuls hubs indexables (SSR, pagination,
canonical — déjà bien faits). Les URLs de recherche filtrée (`/books?subject=…&language=…`)
restent **crawlables mais noindex** quand ≥ 1 filtre actif (canonical vers le hub), pour éviter
l'explosion combinatoire dans l'index. Plus tard (P3) : transformer en URLs propres les
combinaisons qui génèrent du trafic (browse nodes Amazon).

- **Gain** : concentre les signaux sur des hubs forts au lieu de diluer sur des milliers de
  variantes de filtres.
- **Indexation** : nulle perte sur les fiches (aucun noindex côté fiche).
- **Crawl budget** : évite que le budget parte sur la combinatoire infinie de filtres.
- **Risque** : nul si appliqué aux seules URLs de recherche, jamais aux hubs.

### R8 — Crawl budget sans réduire la découvrabilité (P3 — cadre de suivi)

- Ne **jamais** disallow `/_next/image` ou les assets (les couvertures font partie de la valeur
  des fiches) ; ne jamais disallow les paginations.
- `lastmod` honnêtes dans les sitemaps (re-crawl sélectif, pas de re-crawl global).
- Rate limit API réservé aux vrais abus (C5) avec seuil haut — Googlebot ne doit jamais être
  gêné (il est à ~10 req/s max sur un site de cette taille).
- Suivi GSC mensuel : couverture par classe (fiches, rayons, éditeurs, auteurs), « Découvertes,
  non indexées » et « Explorées, non indexées » — attendu élevé les 3-6 premiers mois, c'est la
  rampe normale d'un catalogue de 697k URLs neuves.
- Enrichissement continu des 35 690 fiches minimales (priorité aux rayons à trafic).

- **Gain** : rampe d'indexation maîtrisée et mesurable.
- **Indexation** : positif à 6 mois (Google revient sur ce qu'il juge utile via lastmod).
- **Crawl budget** : c'est l'objet même.
- **Risque** : seules vraies erreurs à éviter = disallow assets/paginations, et sur-crawl
  provoqué par des lastmod falsifiés.

## 4. Ordre d'exécution proposé

| Lot | Contenu | Déploiement |
|---|---|---|
| **SEO-1 (P1)** | R1 sitemaps splittés (API paginée backend + chunks Next) + R2 canonical/301 + R3 JSON-LD Book | API actif direct ; front → `lz` |
| **SEO-2 (P2)** | R4 livres similaires + R5 éditeurs + R7 noindex facettes | front → `lz` |
| **SEO-3 (P2)** | R6 auteurs — **EXCLU par décision propriétaire 06/09 soir : « ma liste n'est pas fiable »** (76,4 % remplis, qualité non garantie). À re-étudier après un nettoyage/dédoublonnage des données auteurs. Les 301 existantes /books/auteurs/{slug} → /books?author= restent en l'état. | — |
| **SEO-4 (P3)** | R8 suivi GSC + enrichissement fiches minimales + browse nodes | continu |

### ✅ SEO-1 + SEO-2 livrés le 06/09 soir (session ZCode)

**Backend (actif immédiatement, vérifié en live)** :
- Nouveau `SitemapController` : `/api/sitemap/books/meta` (697 172 livres, 14 chunks de
  50 000 bornés par intervalles d'id, cache 24 h), `/api/sitemap/books?min_id&max_id`
  (validation par appartenance aux bornes de la meta — les ids sont troués), `/api/sitemap/
  listings/meta` + `?page` (49 annonces, 5 000/page), `/api/sitemap/publishers`
  (46 933 éditeurs, slug calculé côté API, `per_page` jusqu'à 50k) + `/api/sitemap/
  publishers/{slug}`. Throttle dédié 60/min/IP.
- **Ancien `GET /api/sitemap/listings` SUPPRIMÉ** (audit CRITIQUE #2 : get() non borné sur
  les annonces publiées, 0 hit dans les logs).
- `GET /api/books/{book}/related` (Meili même rayon, cache 6 h, fallback fiches récentes).
- Filtre `publisher` sur `/api/books` + `publisher` ajouté aux filterableAttributes Meili
  (books:configure-search relancé).
- C5 : cap `limit` ≤ 50 sur `/api/listings` (vérifié : `?limit=100000` → per_page 50) +
  `/listings` et `/listings/{id}` passés sous `throttle:catalogue` (Limit::none() tant que
  ANTI_SCRAPING_ENABLED=false, cap par IP dès activation).
- C6 : import `ValidationException` corrigé dans `AdminController`.
- C7 : garde `hasTable` sur les 3 migrations destructrices + `migrate --force` ajouté au
  script `lz` + `NODE_TLS_REJECT_UNAUTHORIZED=0` retiré du script (audit). Backup :
  `/usr/local/bin/lz.bak-20260906`.

**Front (en attente de `lz`)** :
- Sitemaps : `app/sitemap.ts` remplacé par des route handlers — `/sitemap.xml` devient un
  **sitemap index** (pages, chunks livres, annonces, éditeurs ; robots.txt inchangé),
  `/sitemap-pages.xml`, `/sitemap-books/[chunk].xml` (50k URLs, lastmod=updated_at),
  `/sitemap-listings/[chunk].xml`, `/sitemap-editeurs.xml`.
- R2 : canonical + 308 des slugs sur `books/[slug]` et `[nickname]/[slug]` (canonical
  construit depuis les données via `lib/book-slug.ts`, partagé cartes/sitemaps/pages).
- R3 : JSON-LD `Book` + `BreadcrumbList` sur les fiches catalogue (les fiches annonces ont
  déjà Book+Offer). WebSite+SearchAction déjà en place dans le layout.
- R4 : section « Du même rayon » (8 fiches) sur chaque fiche livre.
- R5 : hub `/books/editeurs` (paginé) + `/books/editeurs/[slug]` (noindex si < 3 livres).
- R7 : `/books?filtre=…` (subjects/languages/levels/publisher) → noindex,follow ; la
  recherche simple reste indexable. Rayons et fiches inchangés. Pages auteurs : NON
  concernées (R6 exclu).
