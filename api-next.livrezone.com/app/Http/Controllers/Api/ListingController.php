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
        return response()->json(app(\App\Services\ListingSearchService::class)->search($request));
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


}
