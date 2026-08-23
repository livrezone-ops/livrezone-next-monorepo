<?php

namespace App\Services;

use App\Models\Book;
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

        // Source unique : Meilisearch (requête vide = toute la base).
        $builder = Book::search($search);

        // Recherche ciblée ISBN (précise via filtre), sinon full-text Meilisearch.
        if ($search !== '' && $field === 'isbn') {
            $builder->where('isbn_13', str_replace(['-', ' '], '', $search));
        }

        // Filtres catégorie / langue / niveau (codes ou IDs résolus côté MySQL,
        // petit volume ; le filtrage effectif se fait dans Meilisearch).
        $categoryIds = $this->filterService->resolveCategoryIds($request, ['categories', 'category', 'category_id', 'c']);
        if (!empty($categoryIds)) {
            $builder->whereIn('default_category_id', $categoryIds);
        }

        $languageIds = $this->filterService->resolveLanguageIds($request, ['languages', 'language', 'language_id', 'lang']);
        if (!empty($languageIds)) {
            $builder->whereIn('language_id', $languageIds);
        }

        $levelIds = $this->filterService->resolveLevelIds($request, ['levels', 'level', 'level_id']);
        if (!empty($levelIds)) {
            $builder->whereIn('default_level_id', $levelIds);
        }

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

        return $paginated;
    }
}
