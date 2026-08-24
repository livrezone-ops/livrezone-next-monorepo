# Résumé — Page /demandes : Meilisearch + correction liste villes/langues

## Contexte

La page publique `/demandes` (demandes de livres de la communauté) souffrait de deux
problèmes :

1. **Liste de villes vide** dans le filtre : le composant `FilterSidebar` filtre les
   villes dont le `count` (issu de `facets.cities`) est à 0. Or l'endpoint
   `/api/demandes` ne renvoyait **aucun `facets`** → toutes les villes avaient
   `count = 0` → liste vide.
2. L'utilisateur souhaitait **appliquer Meilisearch** à cette page (recherche +
   filtres + pagination + facettes), comme déjà fait pour `/books` et `/librairies`,
   et trier langues/villes par nombre de demandes (desc) puis id (asc), en n'affichant
   que celles > 0.

## Cause racine

`app/Services/OrderService.php::getPublicDemandes()` interrogeait MySQL directement
et ne calculait aucune facette. Le frontend recevait `cities` depuis `/reference-data`
(mais pas de `facets`), donc le filtre ville se vidait.

## Modifications

### Backend (déjà en ligne, PHP interprété)

- **`app/Models/Order.php`**
  - `searchableAs()` → `'orders'`.
  - `shouldBeSearchable()` → uniquement `status === 'published'`.
  - `toSearchableArray()` étendu : `status`, `category_id`, `city_id`
    (depuis `user.profile.city_id`), `language_id` (depuis `book.language_id`),
    `published_at` (timestamp).

- **`app/Console/Commands/ConfigureDemandeSearch.php`** (nouveau)
  - Commande `demandes:configure-search` : `filterable` = `status, category_id,
    city_id, language_id` ; `sortable` = `published_at, id`.

- **`app/Services/OrderService.php`**
  - `getPublicDemandes()` délégué à **Meilisearch (index `orders`)** :
    - Requête principale avec filtres `status`, `category_id`, `city_id`,
      `language_id` + tri `published_at desc` (total = `estimatedTotalHits`).
    - Facettes calculées via `facetDistribution` (`city_id`, `category_id`,
      `language_id`), **sans le filtre ville** pour garder la liste de villes
      complète. Les `category_id`/`language_id` sont remappés en codes
      (`ROMANS`, `fr`, …) pour le frontend.
    - Renvoie désormais `facets.categories / languages / cities`.
  - **Repli SQL** (`getPublicDemandesFallback()`) déclenché si Meilisearch est
    indisponible → la page n'affiche **jamais** zéro demande. Transformation
    factorisée dans `transformOrder()`.
  - Suppression du vieux `applyTextSearchFallback()` devenu inutilisé.

### Frontend (à déployer via `lz`)

- **`app/demandes/page.tsx`** : transmet `initialFacets` (depuis la réponse API)
  au client.
- **`app/demandes/DemandesClient.tsx`** : reçoit `initialFacets` et le passe à
  `FilterSidebar`.
- **`components/FilterSidebar.tsx`** :
  - `sortedLanguages` filtre désormais les langues à `count > 0` et trie
    **count DESC puis id ASC** (avant : tri par code, aucun filtre > 0).
  - `sortedCities` : déjà trié count DESC puis id ASC et filtré > 0 (conforme
    à la demande, inchangé).

## Déploiement (sudo requis)

```bash
sudo DOCKER_HOST=unix:///run/user/1001/docker.sock docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan demandes:configure-search
sudo DOCKER_HOST=unix:///run/user/1001/docker.sock docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan scout:import "App\Models\Order"
lz
```

## Vérifications effectuées

- `php -l` sur `Order.php`, `OrderService.php`, `ConfigureDemandeSearch.php` : OK.
- API live `GET /api/demandes` : `total=5`, `data=5`, `facets` présent.
- Filtres live testés : `city=6` → 5, `language=fr` → 5, `category=ROMANS` → 1,
  `city=6&language=fr` → 5. Aucun retourne zéro.
- SSR live `https://next.livrezone.com/demandes` : rend bien « Affichage de 5 sur 5
  demandes » (les demandes s'affichent).

## Note

Si l'utilisateur voit « aucune demande » côté navigateur, c'est un cache/stale build
ou un filtre actif renvoyant 0 (hard-refresh / vider les filtres). Le backend et le
SSR prouvent que les demandes sont bien servies.
