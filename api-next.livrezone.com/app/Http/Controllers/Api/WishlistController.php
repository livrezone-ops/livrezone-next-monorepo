<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\WishlistDestroyRequest;
use App\Http\Requests\Api\WishlistMergeRequest;
use App\Http\Requests\Api\WishlistStoreRequest;
use App\Models\Favorite;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WishlistController extends Controller
{
    /**
     * GET /api/wishlist
     * Liste les annonces favorites de l'utilisateur connecté.
     */
    public function index(Request $request): JsonResponse
    {
        $favorites = Favorite::with(['listing.book', 'listing.category', 'listing.user.profile.city'])
            ->where('user_id', $request->user()->id)
            ->latest()
            ->get();

        $listings = $favorites->map(function (Favorite $favorite) {
            $listing = $favorite->listing;
            if ($listing && $listing->book) {
                $listing->book->setAppends(['cover_url']);
            }

            return $listing;
        })->filter()->values();

        return response()->json([
            'data' => $listings,
            'count' => $listings->count(),
        ]);
    }

    /**
     * POST /api/wishlist
     * Ajoute une annonce aux favoris (idempotent côté unique).
     */
    public function store(WishlistStoreRequest $request): JsonResponse
    {
        $favorite = Favorite::create([
            'user_id' => $request->user()->id,
            'listing_id' => $request->integer('listing_id'),
        ]);

        return response()->json([
            'data' => $favorite,
            'message' => 'Annonce ajoutée à la wishlist.',
        ], 201);
    }

    /**
     * DELETE /api/wishlist
     * Retire une annonce des favoris.
     */
    public function destroy(WishlistDestroyRequest $request): JsonResponse
    {
        $deleted = Favorite::query()
            ->where('user_id', $request->user()->id)
            ->where('listing_id', $request->integer('listing_id'))
            ->delete();

        return response()->json([
            'deleted' => $deleted > 0,
            'message' => $deleted > 0
                ? 'Annonce retirée de la wishlist.'
                : 'Cette annonce n\'était pas dans votre wishlist.',
        ]);
    }

    /**
     * POST /api/wishlist/merge
     * Fusionne les favoris locaux (guest < 24h) vers le compte connecté.
     */
    public function merge(WishlistMergeRequest $request): JsonResponse
    {
        $userId = $request->user()->id;
        $existing = Favorite::query()
            ->where('user_id', $userId)
            ->pluck('listing_id')
            ->all();

        $toInsert = collect($request->input('listing_ids'))
            ->diff($existing)
            ->values();

        foreach ($toInsert as $listingId) {
            Favorite::create([
                'user_id' => $userId,
                'listing_id' => (int) $listingId,
            ]);
        }

        $count = Favorite::query()->where('user_id', $userId)->count();

        return response()->json([
            'merged' => $toInsert->count(),
            'count' => $count,
            'message' => 'Wishlist synchronisée.',
        ]);
    }
}
