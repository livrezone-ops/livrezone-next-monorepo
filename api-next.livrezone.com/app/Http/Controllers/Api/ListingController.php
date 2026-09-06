<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Listing;
use App\Services\ListingSearchService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ListingController extends Controller
{
    /**
     * Display a listing of the resource (Public search & filters).
     */
    public function index(Request $request)
    {
        return response()->json(app(ListingSearchService::class)->search($request));
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
            'language',
        ])->find($id);

        if (! $listing) {
            return response()->json(['message' => 'Annonce introuvable.'], 404);
        }

        if (! Gate::allows('view', $listing)) {
            return response()->json(['message' => 'Accès interdit.'], 403);
        }

        if ($listing->book) {
            $listing->book->setAppends(['cover_url']);
        }

        // Calcul de l'ancienneté de publication (logique centralisée ici, pas dans le frontend)
        $publishedAgo = null;
        if ($listing->published_at) {
            $days = (int) $listing->published_at->startOfDay()->diffInDays(now()->startOfDay());
            $publishedAgo = $days === 0 ? "Aujourd'hui" : "Il y a {$days} jour".($days > 1 ? 's' : '');
        }

        $data = $listing->toArray();
        $data['published_ago'] = $publishedAgo;

        return response()->json([
            'data' => $data,
        ]);
    }

    // Ancien endpoint sitemap() supprimé (06/09, audit CRITIQUE #2) : get() non
    // borné sur les annonces publiées, 0 hit dans les logs. Remplacé par le
    // SitemapController paginé (route /api/sitemap/*).
}
