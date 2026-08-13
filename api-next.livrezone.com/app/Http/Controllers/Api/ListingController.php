<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Listing;
use App\Models\Category;
use App\Models\Level;
use App\Models\Subject;
use App\Models\Language;

class ListingController extends Controller
{
    /**
     * Display a listing of the resource (Public search & filters).
     */
    public function index(Request $request)
    {
        $query = Listing::query()
            ->with(['book', 'category', 'user.profile.city'])
            ->where('status', 'published');

        // 1. Filtrer par Catégorie (gère la hiérarchie parent-enfants)
        if ($request->filled('category')) {
            $catCode = $request->get('category');
            $category = Category::where('code', $catCode)->first();
            
            if ($category) {
                // Récupérer la catégorie et tous ses enfants (sous-catégories)
                $categoryIds = [$category->id];
                $childrenIds = Category::where('parent_id', $category->id)->pluck('id')->toArray();
                $categoryIds = array_merge($categoryIds, $childrenIds);

                $query->whereIn('category_id', $categoryIds);
            }
        }

        // 2. Filtrer par Niveau (Level)
        if ($request->filled('level')) {
            $levelCode = $request->get('level');
            $levelId = Level::where('code', $levelCode)->value('id');
            if ($levelId) {
                $query->where('level_id', $levelId);
            }
        }

        // 3. Filtrer par Matière (Subject)
        if ($request->filled('subject')) {
            $subCode = $request->get('subject');
            $subId = Subject::where('code', $subCode)->value('id');
            if ($subId) {
                $query->where('subject_id', $subId);
            }
        }

        // 4. Filtrer par Langue (Language)
        if ($request->filled('language')) {
            $langCode = $request->get('language');
            $langId = Language::where('code', $langCode)->value('id');
            if ($langId) {
                $query->where('language_id', $langId);
            }
        }

        // 5. Filtrer par État (book_condition)
        if ($request->filled('condition')) {
            $query->where('book_condition', $request->get('condition'));
        }

        // 6. Filtrer par Utilisateur (autres annonces du vendeur)
        if ($request->filled('user_id')) {
            $query->where('user_id', $request->get('user_id'));
        }

        // Exclure une annonce spécifique (ex: l'annonce en cours de consultation)
        if ($request->filled('exclude')) {
            $query->where('id', '!=', $request->get('exclude'));
        }

        // 7. Recherche textuelle globale
        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->where(function ($q) use ($search) {
                $q->where('listings.title', 'like', "%{$search}%")
                  ->orWhere('listings.description', 'like', "%{$search}%")
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

        return response()->json($listings);
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

        // Restreindre si l'annonce n'est pas publiée (seul l'auteur ou l'admin peut la voir)
        if ($listing->status !== 'published') {
            $user = auth('sanctum')->user();
            if (!$user || ($user->id !== $listing->user_id && !$user->is_admin)) {
                return response()->json(['message' => 'Accès interdit.'], 403);
            }
        }

        if ($listing->book) {
            $listing->book->setAppends(['cover_url']);
        }

        return response()->json([
            'data' => $listing
        ]);
    }
}
