<?php

namespace App\Services;

use App\Models\Book;
use App\Models\Category;
use App\Models\Language;
use App\Models\Level;
use Illuminate\Http\Request;

class BookCatalogueService
{
    public function __construct(
        protected ReferenceFilterService $filterService
    ) {}

    /**
     * Catalogue public : recherche + filtres + pagination DÉLEGÉS à Meilisearch.
     *
     * Meilisearch renvoie les IDs matchés (et le total estimé) sans scanner
     * MySQL. On ne récupère depuis MySQL que les ~12 livres de la page.
     */
    public function search(Request $request)
    {
        // Règle architecture 03/09 (post-incident) : les pages du catalogue
        // chargent AU PLUS 12 livres, exclusivement via Meilisearch (recherche,
        // filtres, facettes, tri, total). MySQL n'est touché que pour hydrater
        // les ≤12 livres de la page par leur clé primaire.
        $limit = min(max(1, $request->integer('limit', 12)), 12);
        $page = max(1, $request->integer('page', 1));

        $search = trim($request->get('search', ''));
        $field = $request->get('field', 'all');
        // Filtre auteur (04/09/2026) : les noms d'auteurs du front pointent vers
        // /books?author={nom} — la box de recherche du front reste VIDE. Côté
        // Meilisearch, `authors` n'est PAS filterable (indexé en chaîne "A, B, C"
        // pour la pertinence), donc on ne peut pas faire where('authors', …) :
        // on cherche l'auteur en restreignant la requête à l'attribut `authors`
        // (attributesToSearchOn). Aucun scan MySQL (règle architecture 03/09).
        $author = trim($request->get('author', ''));

        // --- 1. Facettes : UNE seule requête Meilisearch calcule les 3 distributions,
        //        SANS le filtre langue (pour garder la liste des langues complète), comme
        //        /demandes. Les langues sont la seule facette filtrée par count > 0 côté
        //        front, d'où l'auto-exclusion de la langue ; catégories et niveaux
        //        s'affichent toujours (leurs comptes reflètent les filtres croisés).
        $computeFacets = $request->get('facets', '1') !== '0';

        if ($computeFacets) {
            $facetBuilder = Book::search($author !== '' ? $author : $search, function ($meilisearch, $query, $options) use ($author) {
                $options['facets'] = ['default_category_id', 'language_id', 'default_level_id'];
                $options['hitsPerPage'] = 0; // On ne veut que les facettes
                if ($author !== '') {
                    $options['attributesToSearchOn'] = ['authors'];
                }

                return $meilisearch->search($query, $options);
            });
            $this->applyCrossFilters($facetBuilder, $request, ['languages']);

            $rawFacets = $facetBuilder->raw();
            $categoryFacets = $rawFacets['facetDistribution']['default_category_id'] ?? [];
            $languageFacets = $rawFacets['facetDistribution']['language_id'] ?? [];
            $levelFacets = $rawFacets['facetDistribution']['default_level_id'] ?? [];
        } else {
            $categoryFacets = [];
            $languageFacets = [];
            $levelFacets = [];
        }

        // --- 2. Requête principale (avec tous les filtres) ---
        if ($author !== '') {
            // Le filtre auteur remplace la recherche plein-texte comme requête
            // (le front ne combine jamais les deux : soumettre la box retire le
            // chip auteur). paginate()/orderBy() du builder restent appliqués :
            // Scout fusionne leurs options avant d'invoquer le callback.
            $builder = Book::search($author, function ($meilisearch, $query, $options) {
                $options['attributesToSearchOn'] = ['authors'];

                return $meilisearch->search($query, $options);
            });
        } else {
            $builder = Book::search($search);
        }
        $this->applyCrossFilters($builder, $request);
        $this->applySort($builder, $request);

        // Pagination via Meilisearch (total = estimatedTotalHits, aucun COUNT MySQL).
        $paginated = $builder->paginate($limit, 'page', $page);

        // Les ~12 livres sont hydratés par Scout depuis MySQL : on charge les
        // relations et le comptage d'annonces (ordre Meilisearch préservé).
        $paginated->getCollection()
            ->load(['language', 'defaultCategory', 'defaultLevel'])
            ->loadCount(['listings as active_listings_count' => function ($q) {
                $q->where('status', 'published');
            }]);

        // Transformation en payload ultra-léger.
        $paginated->getCollection()->transform(fn (Book $book) => $this->formatBook($book));

        $response = $paginated->toArray();

        // Map numeric IDs to string codes for the frontend (catégories, langues, niveaux).
        $categoryMap = Category::pluck('code', 'id')->toArray();
        $languageMap = Language::pluck('code', 'id')->toArray();
        $levelMap = Level::pluck('code', 'id')->toArray();

        $mappedCategories = [];
        foreach ($categoryFacets as $id => $count) {
            $code = $categoryMap[$id] ?? $id;
            $mappedCategories[$code] = ($mappedCategories[$code] ?? 0) + $count;
        }
        $mappedLanguages = [];
        foreach ($languageFacets as $id => $count) {
            $code = $languageMap[$id] ?? $id;
            $mappedLanguages[$code] = ($mappedLanguages[$code] ?? 0) + $count;
        }
        $mappedLevels = [];
        foreach ($levelFacets as $id => $count) {
            $code = $levelMap[$id] ?? $id;
            $mappedLevels[$code] = ($mappedLevels[$code] ?? 0) + $count;
        }

        $response['facets'] = [
            'categories' => $mappedCategories,
            'languages' => $mappedLanguages,
            'levels' => $mappedLevels,
        ];

        return $response;
    }

    /**
     * Applique le tri demandé à un builder Meilisearch.
     *
     * `recent` → created_at:desc (attribut sortable, cf. books:configure-search).
     * Toute autre valeur (ou absence) conserve l'ordre de pertinence Meilisearch.
     */
    private function applySort($builder, Request $request): void
    {
        if ($request->get('sort') === 'recent') {
            $builder->orderBy('created_at', 'desc');
        }
    }

    /**
     * Payload public normalisé d'un livre (catalogue, auteur, thème).
     * Le livre doit être chargé avec language/defaultCategory/defaultLevel
     * et le loadCount `active_listings_count`.
     */
    public function formatBook(Book $book): array
    {
        $category = $book->defaultCategory;
        $language = $book->language;
        $level = $book->defaultLevel;

        return [
            'id' => $book->id,
            'isbn_13' => $book->isbn_13,
            'title' => $book->title,
            'authors' => $book->authors,
            'publisher' => $book->publisher,
            'cover_url' => $book->cover_url,
            'cover_thumbnail_url' => $book->getCoverThumbnailUrl(160),
            'cover_thumbnail_url_320' => $book->getCoverThumbnailUrl(320),
            'category' => $category ? [
                'id' => $category->id,
                'name_fr' => $category->name_fr ?? $category->name,
            ] : null,
            'language' => $language ? [
                'id' => $language->id,
                'name_fr' => $language->name_fr ?? $language->name,
            ] : null,
            'level' => $level ? [
                'id' => $level->id,
                'name_fr' => $level->name_fr ?? $level->name,
            ] : null,
            'active_listings_count' => (int) ($book->active_listings_count ?? 0),
            'indicative_price' => $book->indicative_price !== null ? (float) $book->indicative_price : null,
            'indicative_price_currency' => $book->indicative_price_currency,
        ];
    }

    /**
     * Applique les filtres de recherche (recherche, catégorie, langue, niveau) à un
     * builder Meilisearch, en excluant éventuellement une dimension (pour le calcul
     * de sa propre facette).
     */
    private function applyCrossFilters($builder, Request $request, array $exclude = []): void
    {
        $search = trim($request->get('search', ''));
        $field = $request->get('field', 'all');

        if ($search !== '' && $field === 'isbn') {
            $builder->where('isbn_13', str_replace(['-', ' '], '', $search));
        }

        if (! in_array('categories', $exclude, true)) {
            $categoryIds = $this->filterService->resolveCategoryIds($request, ['categories', 'category', 'category_id', 'c']);
            if (! empty($categoryIds)) {
                $builder->whereIn('default_category_id', $categoryIds);
            }
        }

        if (! in_array('languages', $exclude, true)) {
            $languageIds = $this->filterService->resolveLanguageIds($request, ['languages', 'language', 'language_id', 'lang']);
            if (! empty($languageIds)) {
                $builder->whereIn('language_id', $languageIds);
            }
        }

        if (! in_array('levels', $exclude, true)) {
            $levelIds = $this->filterService->resolveLevelIds($request, ['levels', 'level', 'level_id']);
            if (! empty($levelIds)) {
                $builder->whereIn('default_level_id', $levelIds);
            }
        }
    }
}
