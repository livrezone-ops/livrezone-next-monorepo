<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Listing;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'filter' => ['nullable', Rule::in(['online', 'offline', 'all'])],
            'search' => 'nullable|string|max:100',
            'sort_by' => ['nullable', Rule::in(['created_at', 'price', 'title'])],
            'sort_dir' => ['nullable', Rule::in(['asc', 'desc'])],
        ]);

        $userId = $request->user()->id;
        $filter = $request->input('filter', 'online');

        if ($filter === 'online') {
            $query = Listing::getActiveListingsByUser($userId);
        } elseif ($filter === 'offline') {
            $query = Listing::getDesactivatedListingsByUser($userId);
        } else {
            $query = Listing::getListingsByUser($userId);
        }

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('isbn_13', 'like', "%{$search}%");
            });
        }

        if ($request->filled('sort_by')) {
            $sortBy = $request->input('sort_by');
            $sortDir = $request->input('sort_dir', 'desc');
            $query->orderBy($sortBy, $sortDir);
        } else {
            $query->orderBy('created_at', 'desc');
        }

        $limit = $request->input('limit', 8);
        $listings = $query->with(['book', 'category'])->paginate($limit);

        $activeCount = Listing::getActiveListingsByUser($userId)->count();
        $soldCount = Listing::where('user_id', $userId)->where('status', 'sold')->count();

        return response()->json([
            'listings' => $listings->items(),
            'meta' => [
                'current_page' => $listings->currentPage(),
                'last_page' => $listings->lastPage(),
                'total' => $listings->total(),
                'active_count' => $activeCount,
                'sold_count' => $soldCount,
            ]
        ]);
    }

    public function updateInline(Request $request, Listing $listing)
    {
        if ($listing->user_id !== $request->user()->id) {
            abort(403);
        }

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'price' => 'required|numeric|min:0',
            'discount_price' => 'nullable|numeric|min:0|lt:price',
        ]);

        $listing->update($validated);

        return response()->json(['message' => 'Annonce mise à jour avec succès', 'listing' => $listing]);
    }

    public function updateStatus(Request $request, Listing $listing)
    {
        $authUserId = $request->user()?->id ?? 'AUCUN';
        \Illuminate\Support\Facades\Log::info('updateStatus appelé', [
            'listing_id' => $listing->id,
            'listing_user_id' => $listing->user_id,
            'auth_user_id' => $authUserId,
            'status_payload' => $request->input('status'),
        ]);

        if ($listing->user_id !== $request->user()->id) {
            abort(403);
        }

        $validated = $request->validate([
            'status' => ['required', Rule::in(['sold', 'deleted'])]
        ]);

        $listing->update(['status' => $validated['status']]);

        return response()->json(['message' => 'Statut mis à jour']);
    }

    public function bulkUpdateStatus(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:listings,id',
            'status' => ['required', Rule::in(['sold', 'deleted'])]
        ]);

        Listing::whereIn('id', $validated['ids'])
            ->where('user_id', $request->user()->id)
            ->update(['status' => $validated['status']]);

        return response()->json(['message' => 'Annonces mises à jour']);
    }

    public function bulkApplyDiscount(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:listings,id',
            'discount_percentage' => 'required|numeric|min:1|max:99'
        ]);

        $listings = Listing::whereIn('id', $validated['ids'])
            ->where('user_id', $request->user()->id)
            ->get();

        foreach ($listings as $listing) {
            $newPrice = $listing->price * (1 - ($validated['discount_percentage'] / 100));
            $listing->update(['discount_price' => round($newPrice, 2)]);
        }

        return response()->json(['message' => 'Remises appliquées']);
    }
}
