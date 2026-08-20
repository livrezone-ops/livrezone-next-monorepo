<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Listing;
use App\Models\Category;
use App\Models\Level;
use App\Models\Subject;
use App\Models\Language;
use Illuminate\Support\Facades\Gate;

class ListingController extends Controller
{
    /**
     * Display a listing of the resource (Public search & filters).
     */
    public function index(Request $request)
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

        // 1. Filtrer par Catégories : codes (category=A,B ou categories=A,B)
        //    ou IDs historiques (c=1,2,3), avec inclusion des enfants + affinage.
        $categoryCodes = $this->csvParam($request, ['categories', 'category']);
        $categoryIds = !empty($categoryCodes)
            ? Category::whereIn('code', $categoryCodes)->pluck('id')->all()
            : $this->csvIntParam($request->get('c'));
        if (!empty($categoryIds)) {
            $query->whereIn('category_id', $this->resolveCategoryIds($categoryIds));
        }

        // 2. Filtrer par Niveaux (levels=A,B ou lvl=1,2)
        $levelCodes = $this->csvParam($request, ['levels', 'level']);
        $levelIds = !empty($levelCodes)
            ? Level::whereIn('code', $levelCodes)->pluck('id')->all()
            : $this->csvIntParam($request->get('lvl'));
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
        $languageCodes = $this->csvParam($request, ['languages', 'language']);
        $languageIds = !empty($languageCodes)
            ? Language::whereIn('code', $languageCodes)->pluck('id')->all()
            : $this->csvIntParam($request->get('l'));
        if (!empty($languageIds)) {
            $query->whereIn('language_id', $languageIds);
        }

        // 5. Filtrer par État du livre (condition=neuf,occas ou condiciones=.../cond=...)
        $conditions = $this->csvParam($request, ['conditions', 'condition', 'cond']);
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
        $cityIds = !empty($this->csvParam($request, ['city', 'cities']))
            ? $this->csvParam($request, ['city', 'cities'])
            : $this->csvIntParam($request->get('city_id'));
        $cityIds = array_map('intval', array_unique(array_filter($cityIds, 'is_numeric')));
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

        // 8. Recherche textuelle globale (ISBN, titre, auteur, éditeur)
        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->where(function ($q) use ($search) {
                $q->where('listings.title', 'like', "%{$search}%")
                  ->orWhere('listings.isbn_13', 'like', "%{$search}%")
                  ->orWhereHas('book', function ($bq) use ($search) {
                      $bq->where('title', 'like', "%{$search}%")
                        ->orWhere('publisher', 'like', "%{$search}%")
                        ->orWhere('authors', 'like', "%{$search}%");
                  });
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
            $query->latest('published_at')->latest('created_at');
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

        return response()->json($payload);
    }

    /**
     * Display the specified resource (Public detail view).
     */
    public function show($id)
    {
        $listing = Listing::with([
            'user.profile.city',
            'category.parent',
            'level',
            'subject',
            'book',
            'language'
        ])->find($id);

        if (!$listing) {
            return response()->json(['message' => 'Annonce introuvable.'], 404);
        }

        if (!Gate::allows('view', $listing)) {
            return response()->json(['message' => 'Accès interdit.'], 403);
        }

        if ($listing->book) {
            $listing->book->setAppends(['cover_url']);
        }

        // Calcul de l'ancienneté de publication (logique centralisée ici, pas dans le frontend)
        $publishedAgo = null;
        if ($listing->published_at) {
            $days = (int) $listing->published_at->startOfDay()->diffInDays(now()->startOfDay());
            $publishedAgo = $days === 0 ? "Aujourd'hui" : "Il y a {$days} jour" . ($days > 1 ? 's' : '');
        }

        $data = $listing->toArray();
        $data['published_ago'] = $publishedAgo;

        return response()->json([
            'data' => $data
        ]);
    }

    /**
     * Endpoint optimisé pour la génération du sitemap (Next.js).
     * Retourne uniquement les champs nécessaires pour construire les URLs.
     */
    public function sitemap()
    {
        $listings = Listing::with(['user.profile', 'book:id,isbn_13'])
            ->where('status', 'published')
            ->select('id', 'title', 'updated_at', 'user_id', 'book_id', 'isbn_13')
            ->get();

        $data = $listings->map(function ($listing) {
            return [
                'id' => $listing->id,
                'title' => $listing->title,
                'updated_at' => $listing->updated_at,
                'nickname' => $listing->user->profile->nickname ?? 'utilisateur-' . $listing->user_id,
                'isbn' => $listing->isbn_13 ?? $listing->book->isbn_13 ?? 'livre',
            ];
        });

        return response()->json(['data' => $data]);
    }

    /**
     * Récupère la première valeur non vide parmi une liste de paramètres
     * et la découpe en tableau (support CSV : "ROMANS,BD").
     */
    private function csvParam(Request $request, array $keys): array
    {
        $value = null;
        foreach ($keys as $key) {
            if ($request->has($key) && $request->filled($key)) {
                $value = $request->get($key);
                break;
            }
        }
        if ($value === null) {
            return [];
        }
        $parts = is_array($value) ? $value : explode(',', $value);
        return array_values(array_filter(array_map('trim', $parts), fn ($v) => $v !== ''));
    }

    /**
     * Découpe un paramètre CSV en entiers uniques (format historique "c=1,2,3").
     */
    private function csvIntParam($value): array
    {
        if ($value === null || $value === '') {
            return [];
        }
        $parts = is_array($value) ? $value : explode(',', $value);
        $ints = [];
        foreach ($parts as $part) {
            $trimmed = trim($part);
            if (is_numeric($trimmed)) {
                $ints[] = (int) $trimmed;
            }
        }
        return array_values(array_unique($ints));
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

    /**
     * Résout les IDs de catégories sélectionnés avec :
     * - inclusion des descendants pour un parent ;
     * - affinage : si un parent ET un de ses enfants sont cochés, seul l'enfant est retenu.
     */
    private function resolveCategoryIds(array $categoryIds): array
    {
        if (empty($categoryIds)) {
            return [];
        }

        $allCategories = Category::all()->keyBy('id');

        $selected = [];
        foreach ($categoryIds as $catId) {
            $category = $allCategories->get($catId);
            if (!$category) {
                continue;
            }
            $descendants = array_diff($category->selfAndDescendantIds(), [$catId]);
            $hasSelectedDescendant = count(array_intersect($descendants, $categoryIds)) > 0;
            if (!$hasSelectedDescendant) {
                $selected[] = $catId;
            }
        }

        $merged = [];
        foreach ($selected as $catId) {
            $category = $allCategories->get($catId);
            if (!$category) {
                continue;
            }
            $merged = array_merge($merged, $category->selfAndDescendantIds());
        }

        return array_values(array_unique($merged));
    }
}
