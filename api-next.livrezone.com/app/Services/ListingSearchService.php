<?php

namespace App\Services;

use Illuminate\Http\Request;
use App\Models\Listing;
use App\Models\Category;
use App\Models\Level;
use App\Models\Subject;
use App\Models\Language;

class ListingSearchService
{
    public function __construct(
        protected ReferenceFilterService $filterService
    ) {}

    /**
     * Search listings based on the request filters.
     *
     * @param Request $request
     * @return array
     */
    public function search(Request $request): array
    {
        // Optimisation de la page d'accueil (welcome page)
        // Si la requête ne contient que les paramètres 'compact', 'limit' ou 'page',
        // on met en cache le résultat pendant 10 minutes (600 secondes) via Redis/Cache.
        $isHomepageCacheable = $request->get('compact') == '1' && count($request->except(['compact', 'limit', 'page'])) === 0;

        if ($isHomepageCacheable) {
            $limit = $request->integer('limit', 12);
            $page = $request->integer('page', 1);
            $cacheKey = "listings_homepage_{$limit}_{$page}";
            
            $ttl = config('livrezone.cache_ttl.homepage_listings', 600);

            return \Illuminate\Support\Facades\Cache::remember($cacheKey, $ttl, function () use ($request) {
                return $this->executeSearch($request);
            });
        }

        return $this->executeSearch($request);
    }

    private function executeSearch(Request $request): array
    {
        $query = Listing::query()->where('status', 'published');

        if ($request->get('compact') == '1') {
            $query->select('id', 'title', 'price', 'discount_price', 'book_condition', 'cover_path', 'cover_source_url', 'isbn_13', 'user_id', 'book_id')
                ->with([
                    'book:id,authors,isbn_13,cover_path,cover_source_url', // Requis pour l'accesseur cover_url
                    'user:id',
                    'user.profile:id,user_id,nickname,city_id',
                    'user.profile.city:id,name'
                ]);
        } else {
            $query->with(['book', 'category', 'user.profile.city']);
        }

        // 1. Filtrer par Catégories : codes ou IDs avec inclusion des enfants + affinage.
        $categoryIds = $this->filterService->resolveCategoryIds($request);
        if (!empty($categoryIds)) {
            $query->whereIn('category_id', $categoryIds);
        }

        // 2. Filtrer par Niveaux (levels=A,B ou lvl=1,2)
        $levelIds = $this->filterService->resolveLevelIds($request);
        if (!empty($levelIds)) {
            $query->whereIn('level_id', $levelIds);
        }

        // 3. Filtrer par Matière (Subject)
        if ($request->filled('subject')) {
            $subCode = $request->get('subject');
            $subId = Subject::where('code', $subCode)->value('id');
            if ($subId) {
                $query->where('subject_id', $subId);
            }
        }

        // 4. Filtrer par Langues (languages=fr,ar ou l=2,1)
        $languageIds = $this->filterService->resolveLanguageIds($request);
        if (!empty($languageIds)) {
            $query->whereIn('language_id', $languageIds);
        }

        // 5. Filtrer par État du livre (condition=neuf,occas ou condiciones=.../cond=...)
        $conditions = $this->filterService->csvParam($request, ['conditions', 'condition', 'cond']);
        $conditions = array_values(array_intersect(
            array_map('strtolower', $conditions),
            ['neuf', 'occas']
        ));
        if (!empty($conditions)) {
            $query->whereIn('book_condition', $conditions);
        }

        // 6. Filtrer par prix de vente (price, ou discount_price si présent).
        //    Ex : min_price/max_price (ou min/max historique).
        $minPrice = $this->floatOrNull(
            $request->has('min_price') ? $request->get('min_price') : $request->get('min')
        );
        $maxPrice = $this->floatOrNull(
            $request->has('max_price') ? $request->get('max_price') : $request->get('max')
        );

        $priceExpr = '
            COALESCE(discount_price, price)';

        if ($minPrice !== null) {
            $query->whereRaw($priceExpr . ' >= ?', [$minPrice]);
        }
        if ($maxPrice !== null) {
            $query->whereRaw($priceExpr . ' <= ?', [$maxPrice]);
        }

        // 6b. Filtrer par villes (city=1,2 ou city_id=1,2) — communes de l'annonceur
        $cityIds = $this->filterService->resolveCityIds($request);
        if (!empty($cityIds)) {
            $query->whereHas('user.profile', function ($q) use ($cityIds) {
                $q->whereIn('city_id', $cityIds);
            });
        }

        // 7. Filtrer par Utilisateur (autres annonces du vendeur)
        if ($request->filled('user_id')) {
            $query->where('user_id', $request->get('user_id'));
        }

        // Exclure une annonce spécifique (ex: l'annonce en cours de consultation)
        if ($request->filled('exclude')) {
            $query->where('id', '!=', $request->get('exclude'));
        }

        // 8. Recherche textuelle globale (via Meilisearch)
        if ($request->filled('search')) {
            $search = $request->get('search');
            
            // On récupère d'abord les IDs correspondants très rapidement via Meilisearch
            $listingIds = \App\Models\Listing::search($search)->take(200)->keys();
            $bookIds = \App\Models\Book::search($search)->take(200)->keys();
            
            $query->where(function ($q) use ($listingIds, $bookIds) {
                $q->whereIn('id', $listingIds)
                  ->orWhereIn('book_id', $bookIds);
            });
        }

        // 8. Tri des résultats
        $sort = $request->get('sort', 'latest');
        if ($sort === 'price_asc') {
            // Utilise le prix de promotion si disponible, sinon le prix normal
            $query->orderByRaw('COALESCE(discount_price, price) ASC');
        } elseif ($sort === 'price_desc') {
            $query->orderByRaw('COALESCE(discount_price, price) DESC');
        } else {
            // Tri par date de publication décroissante.
            // COALESCE gère les annonces sans published_at (import), et l'id
            // sert de tie-breaker stable pour éviter un ordre arbitraire
            // quand plusieurs published_at sont identiques.
            $query->orderByRaw('COALESCE(published_at, created_at) DESC')->latest('id');
        }

        // Pagination
        $limit = $request->integer('limit', 12);
        $listings = $query->paginate($limit);

        // S'assurer que l'accesseur cover_url du livre est bien inclus dans le JSON
        $listings->getCollection()->transform(function ($listing) {
            if ($listing->book) {
                $listing->book->setAppends(['cover_url']);
            }
            return $listing;
        });

        $payload = $listings->toArray();

        // Bornes de prix réelles (prix de vente) pour le slider dynamique.
        // Scoped au même périmètre que la recherche (ex: user_id pour une bibliothèque).
        // Inutile en mode compact (homepage) : évite un scan complet de la table à chaque requête.
        if ($request->get('compact') == '1') {
            $payload['price_min'] = 0;
            $payload['price_max'] = 500;
        } else {
            $boundsQuery = Listing::where('status', 'published');
            if ($request->filled('user_id')) {
                $boundsQuery->where('user_id', $request->get('user_id'));
            }
            $bounds = $boundsQuery
                ->selectRaw('MIN(COALESCE(discount_price, price)) as min_price, MAX(COALESCE(discount_price, price)) as max_price')
                ->first();

            $payload['price_min'] = (float) ($bounds->min_price ?? 0);
            $payload['price_max'] = (float) ($bounds->max_price ?? 500);
        }

        return $payload;
    }

    /**
     * Convertit une valeur en flottant, ou null si absente/invalide.
     */
    private function floatOrNull($value): ?float
    {
        if ($value === null || $value === '' || !is_numeric($value)) {
            return null;
        }
        return (float) $value;
    }
}
