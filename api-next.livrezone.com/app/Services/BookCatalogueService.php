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
        $limit = $request->integer('limit', 12);
        if ($limit > 48) {
            $limit = 48;
        }
        $page = max(1, $request->integer('page', 1));

        $search = trim($request->get('search', ''));
        $field = $request->get('field', 'all');

        // --- 1. Facettes : UNE seule requête Meilisearch calcule les 3 distributions,
        //        SANS le filtre langue (pour garder la liste des langues complète), comme
        //        /demandes. Les langues sont la seule facette filtrée par count > 0 côté
        //        front, d'où l'auto-exclusion de la langue ; catégories et niveaux
        //        s'affichent toujours (leurs comptes reflètent les filtres croisés).
        $computeFacets = $request->get('facets', '1') !== '0';

        if ($computeFacets) {
            $facetBuilder = Book::search($search, function ($meilisearch, $query, $options) {
                $options['facets'] = ['default_category_id', 'language_id', 'default_level_id'];
                $options['hitsPerPage'] = 0; // On ne veut que les facettes

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
        $builder = Book::search($search);
        $this->applyCrossFilters($builder, $request);

        // Pagination via Meilisearch (total = estimatedTotalHits, aucun COUNT MySQL).
        $paginated = $builder->paginate($limit, 'page', $page);

        // Les ~12 livres sont hydratés par Scout depuis MySQL : on charge les
        // relations et le comptage d'annonces (ordre Meilisearch préservé).
        $paginated->getCollection()
            ->load(['language', 'defaultCategory', 'defaultLevel']);

        // Transformation en payload ultra-léger.
        $paginated->getCollection()->transform(function ($book) {
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
            ];
        });

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
