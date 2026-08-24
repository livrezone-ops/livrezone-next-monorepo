# Meilisearch — Résumé d'implémentation

Documentation de ce qui a été mis en place pour le catalogue de livres (`books`),
et du reste à faire. Référence : code réel dans `app/Services/`, `app/Models/Book.php`,
`app/Console/Commands/ConfigureBookSearch.php`, `database/migrations/2026_08_23_000001_add_search_indexes.php`.

---

## Objectif

Faire de Meilisearch la source unique du catalogue (recherche + filtres + pagination)
afin de ne plus jamais scanner les ~654k lignes MySQL (`books`) côté API.

---

## Ce qui a été fait

### 1. Recherche / filtres / pagination délégués à Meilisearch
`app/Services/BookCatalogueService.php` → `search(Request $request)` :
- Utilise `Book::search($search)->paginate($limit)` au lieu de `Book::query()->paginate()`.
- Filtres catégorie / langue / niveau appliqués via `whereIn` (attributs `filterable`).
- Le total renvoyé provient de `estimatedTotalHits` (Meilisearch) → **aucun `COUNT(*)` MySQL**.
- Les ~12 livres de la page sont hydratés depuis MySQL par Scout (`whereIn('id', …)`),
  avec relations (`language`, `defaultCategory`, `defaultLevel`).

### 2. Indexation des champs de filtre
`app/Models/Book.php` → `toSearchableArray()` étendu avec :
`default_category_id`, `language_id`, `default_level_id`, `created_at` (timestamp).
(`id`, `title`, `authors`, `isbn_13`, `publisher`, `cover_url` déjà présents.)

### 3. Configuration de l'index Meilisearch
`app/Console/Commands/ConfigureBookSearch.php` (commande `books:configure-search`) :
- `filterableAttributes` = `default_category_id`, `language_id`, `default_level_id`, `isbn_13`.
- `sortableAttributes` = `created_at`, `id`.

### 4. Index MySQL (annexes)
Migration `2026_08_23_000001_add_search_indexes.php` :
- Index composite `listings(book_id, status)` (accélère le comptage des annonces
  dans `BookDetailService` et le `withCount` résiduel).

### 5. Détail d'un livre factorisé dans un Service
`app/Services/BookDetailService.php` :
- Lookup par **ID en priorité** (clé primaire, évite le full scan du vieux `OR`),
  fallback isbn_13 / title, extraction de l'ID en tête du slug `{id}-{isbn}-{title}`.
- Charge relations + `active_listings_count`.
- `BookController::show()` est devenu skinny (délègue au service).

### 6. Suppression du count par carte
Le `loadCount` sur `listings` a été retiré de `BookCatalogueService` et le champ
`active_listings_count` n'est plus renvoyé pour le catalogue. Le compte des annonces
n'existe **plus que sur la page détail**. Les cartes affichent uniquement le CTA
« Demander ce livre ».

### 7. Correction des facettes (catégories / langues / niveaux)
Anciennement, `BookCatalogueService::search()` ne calculait que `facets.categories`
(et y appliquait les filtres langue/niveau), jamais `facets.languages` ni
`facets.levels`. Le frontend `BooksClient` ne transmettait par ailleurs **jamais**
`facets` à `FilterSidebar` → la section « Langues » apparaissait vide (count = 0
filtrait toutes les options), et « Niveau » n'affichait aucun compte.

Corrections :
- **Backend** : les 3 facettes (`default_category_id`, `language_id`,
  `default_level_id`) sont calculées dans **UNE seule** requête Meilisearch
  (helper `applyCrossFilters()`, auto-excluant le filtre langue pour garder la
  liste des langues complète, comme `/demandes`). Les IDs numériques sont remappés
  en codes (`Category`/`Language`/`Level`) → `facets.categories / languages / levels`.
  Un param `facets=0` permet de sauter le calcul de facettes (appels par section).
- **Frontend** : `page.tsx` récupère `result.facets` (et un appel `getBooks({limit:1})`
  en vue par défaut) et le passe à `BooksClient` → `FilterSidebar` (`facets` prop).
  Type `BooksResult.facets` étendu à `languages`/`levels`. Les appels par section
  (vue Netflix) passent `facets:false` pour ne pas recalculer les facettes 6×.

**Perf** : la 1ʳᵉ version calculait 3 facettes séparées (4 requêtes Meilisearch par
`getBooks`) ; avec la vue par défaut (6 sections + 1), ça faisait ~28 requêtes au
cache miss → lenteurs de navigation. Désormais 2 requêtes par `getBooks` (1 facette
globale + 1 principale) et les sections skippent les facettes → ~8 requêtes.

Aucun réindexation nécessaire (`language_id` et `default_level_id` sont déjà
`filterable`). Déploiement front via `lz`.

---

## Commandes de déploiement

```bash
sudo DOCKER_HOST=unix:///run/user/1001/docker.sock docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan migrate
sudo DOCKER_HOST=unix:///run/user/1001/docker.sock docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan books:configure-search
sudo DOCKER_HOST=unix:///run/user/1001/docker.sock docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan scout:import "App\Models\Book"
# Puis rebuild du front :
lz
```

Vérification effectuée (serveur) : `DRIVER=meilisearch`, `BOOKS_INDEX=654004`,
`/api/books?limit=12` ≈ 0.23 s.

---

## Ce qui reste à faire

- **`lz`** : à lancer pour builder le front (pagination classique restaurée + slug
  `{id}-{isbn}-{titre}` sur les cartes). Le back-end est déjà live (PHP interprété).
- **Surveiller les logs** Caddy / Laravel / Meilisearch après le switch complet.
- **Cohérence `BookAutocompleteService`** : vérifier qu'il reste compatible avec le
  nouvel index (filterable attributes) — pas de changement requis identifié.
- **Si la base `books` est reworkée** (champs manquants en cours d'ajout) :
  - Ajuster `toSearchableArray()` et les `filterableAttributes` si de nouveaux
    champs de filtre apparaissent.
  - Relancer `scout:import "App\Models\Book"` après la refonte pour réindexer
    intégralement avec les nouveaux champs.
- **Optionnel (UX)** : barre de catégories cliquable en haut de `/books`
  (filtrage instantané Meilisearch) pour pousser l'objectif « catalogue = demande ».
- **Optionnel (tuning)** : `searchableAttributes`, synonyms, ranking rules dans
  Meilisearch selon les retours de recherche réelle.

---

## Annuaire des librairies (profils vendeurs)

**Meilisearch est le moteur de recherche par défaut** du projet. Outre le catalogue
`books` (index `books`), il alimente aussi l'annuaire des librairies (`/libraries`),
via l'index `profiles`.

### Index `profiles`
- `App\Models\Profile` implémente `Laravel\Scout\Searchable`.
- `searchableAttributes = ['nickname']` → la recherche plein texte porte
  **strictement sur le nickname** (jamais le nom réel de l'utilisateur).
- `filterableAttributes` : `city_id`, `profile_type`, `listing_count`, `profile_book_conditions`.
- `sortableAttributes` : `subscription_rank`, `rating_average`, `listing_count`, `id`.

### Périmètre de l'annuaire (`profile_type` = `librairie`)
L'annuaire des librairies liste les profils de type `librairie`. L'ENUM est
`['étudiant(e)', 'passionné(e)', 'librairie']` et la base de données stocke
exclusivement `librairie`. Le filtre (`LibraryService`) et `shouldBeSearchable()`
ne retiennent donc que la valeur `librairie` (aucune référence à `library`).

### Counter cache (`profiles.listing_count`)
Pour afficher et trier instantanément le nombre de publications, un compteur en base
(`profiles.listing_count` = annonces `published`) est maintenu par
`App\Services\ProfileSearchService` et l'observer `App\Observers\ListingObserver`
(déclenché sur changement de `status` / `book_condition` / `user_id`, et à la
suppression). `listing_count` sert au tri et à l'affichage, pas au périmètre.

### Conditions de livres (`profiles.profile_book_conditions`)
Valeur **unique déclarée à l'inscription** (`neuf` ou `occas`), stockée en colonne
`profiles.profile_book_conditions` (et mirrorée dans l'index). Permet le filtre
Meilisearch `profile_book_conditions = "neuf"`.

### Tri prioritaire des comptes payants
`subscription_rank` (premium = 3, pro = 2, free = 1) est **toujours** ordonné en DESC
en premier, quel que soit le tri secondaire (rating ou publications), afin de maximiser
la visibilité des comptes payants.

### Déploiement
```bash
sudo DOCKER_HOST=unix:///run/user/1001/docker.sock docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan migrate
sudo DOCKER_HOST=unix:///run/user/1001/docker.sock docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan profiles:configure-search
sudo DOCKER_HOST=unix:///run/user/1001/docker.sock docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan scout:import "App\Models\Profile"
# Puis rebuild du front :
lz
```

La commande `profiles:configure-search` configure l'index **et** pré-remplit les
profils existants : `profile_book_conditions` est mis à `occas` par défaut pour tous
les profils ne l'ayant pas déclaré, et `listing_count` est recalculé (nombre d'annonces
`published`). Le `scout:import` pousse ensuite tout l'index.

Pour réindexer le catalogue de livres (même invocation) :
```bash
sudo DOCKER_HOST=unix:///run/user/1001/docker.sock docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan scout:import "App\Models\Book"
```
