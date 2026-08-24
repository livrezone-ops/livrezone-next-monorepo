<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HeroMessage;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AdminController extends Controller
{

    // ------------------------------------------------------------------
    // Utilisateurs
    // ------------------------------------------------------------------

    public function users(Request $request, \App\Services\AdminDashboardService $adminService)
    {
        return response()->json($adminService->getUsersList($request->all()));
    }

    public function updateUserStatus(Request $request, User $user)
    {
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Vous ne pouvez pas modifier votre propre statut.'], 422);
        }

        $validated = $request->validate([
            'is_active' => 'required|boolean',
        ]);

        $user->update(['is_active' => $validated['is_active']]);

        return response()->json([
            'message' => $validated['is_active'] ? 'Utilisateur activé.' : 'Utilisateur désactivé.',
            'user' => ['id' => $user->id, 'is_active' => $user->is_active],
        ]);
    }

    /**
     * Changement du profil d'abonnement d'un utilisateur (free / pro / premium).
     * Délègue la logique métier à SubscriptionService.
     */
    public function updateUserSubscription(Request $request, User $user)
    {
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Vous ne pouvez pas modifier votre propre abonnement.'], 422);
        }

        $validated = $request->validate([
            'subscription_type' => ['required', Rule::in(\App\Services\SubscriptionService::TYPES)],
        ]);

        $profile = app(\App\Services\SubscriptionService::class)
            ->changeSubscription($user, $validated['subscription_type']);

        return response()->json([
            'message' => 'Profil d\'abonnement mis à jour.',
            'profile' => $profile,
        ]);
    }

    // ------------------------------------------------------------------
    // Listings
    // ------------------------------------------------------------------

    public function listings(Request $request)
    {
        $request->validate([
            'filter' => ['nullable', Rule::in(['all', 'online', 'offline', 'pending', 'archived', 'deleted'])],
            'search' => 'nullable|string|max:100',
            'sort_by' => ['nullable', Rule::in(['created_at', 'price', 'title'])],
            'sort_dir' => ['nullable', Rule::in(['asc', 'desc'])],
        ]);

        $filter = $request->input('filter', 'all');
        $query = Listing::query()->with(['book', 'category', 'user.profile']);

        switch ($filter) {
            case 'online':
                $query->whereIn('status', ['published', 'active']);
                break;
            case 'offline':
                $query->whereIn('status', ['hidden', 'expired', 'sold']);
                break;
            case 'pending':
                $query->where('status', 'pending_admin');
                break;
            case 'archived':
                $query->where('status', 'archived');
                break;
            case 'deleted':
                $query->where('status', 'deleted');
                break;
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('listings.title', 'like', "%{$search}%")
                  ->orWhere('listings.isbn_13', 'like', "%{$search}%")
                  ->orWhere('listings.author', 'like', "%{$search}%")
                  ->orWhere('listings.publisher', 'like', "%{$search}%")
                  ->orWhereHas('user.profile', function ($pq) use ($search) {
                      $pq->where('nickname', 'like', "%{$search}%");
                  });
            });
        }

        if ($request->filled('sort_by')) {
            $sortBy = $request->input('sort_by');
            $sortDir = $request->input('sort_dir', 'desc');
            $query->orderBy($sortBy, $sortDir);
        } else {
            $query->orderBy('created_at', 'desc');
        }

        $limit = $request->integer('limit', 20);
        $listings = $query->paginate($limit);

        return response()->json([
            'listings' => $listings->items(),
            'meta' => [
                'current_page' => $listings->currentPage(),
                'last_page' => $listings->lastPage(),
                'total' => $listings->total(),
                'status_counts' => [
                    'online' => Listing::whereIn('status', ['published', 'active'])->count(),
                    'offline' => Listing::whereIn('status', ['hidden', 'expired', 'sold'])->count(),
                    'pending' => Listing::where('status', 'pending_admin')->count(),
                    'archived' => Listing::where('status', 'archived')->count(),
                    'deleted' => Listing::where('status', 'deleted')->count(),
                ],
            ],
        ]);
    }

    public function updateListingStatus(Request $request, Listing $listing)
    {
        $validated = $request->validate([
            'action' => ['required', Rule::in(['activate', 'deactivate', 'delete'])],
        ]);

        $newStatus = match ($validated['action']) {
            'activate' => 'published',
            'deactivate' => 'hidden',
            'delete' => 'deleted',
        };

        $listing->update(['status' => $newStatus]);

        return response()->json([
            'message' => $this->listingActionMessage($validated['action']),
            'listing' => ['id' => $listing->id, 'status' => $listing->status],
        ]);
    }

    public function bulkListingStatus(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:listings,id',
            'action' => ['required', Rule::in(['activate', 'deactivate', 'delete'])],
        ]);

        $newStatus = match ($validated['action']) {
            'activate' => 'published',
            'deactivate' => 'hidden',
            'delete' => 'deleted',
        };

        Listing::whereIn('id', $validated['ids'])->update(['status' => $newStatus]);

        return response()->json(['message' => $this->actionMessage($validated['action'])]);
    }

    // ------------------------------------------------------------------
    // Hero messages
    // ------------------------------------------------------------------

    public function hero()
    {
        $messages = HeroMessage::query()
            ->orderBy('sort_order')
            ->get()
            ->map(fn (HeroMessage $m) => $m->toHeroMessageShape())
            ->values();

        return response()->json(['messages' => $messages]);
    }

    public function storeHero(Request $request)
    {
        $validated = $request->validate([
            'messages' => 'required|array|min:1',
            'messages.*.id' => 'nullable|integer',
            'messages.*.language' => 'required|in:fr,ar',
            'messages.*.direction' => 'required|in:ltr,rtl',
            'messages.*.title' => 'required|string|max:255',
            'messages.*.description' => 'required|string|max:5000',
            'messages.*.primaryAction.label' => 'required|string|max:100',
            'messages.*.primaryAction.href' => 'required|string|max:255',
            'messages.*.secondaryAction.label' => 'nullable|string|max:100',
            'messages.*.secondaryAction.href' => 'nullable|string|max:255',
        ]);

        DB::transaction(function () use ($validated) {
            HeroMessage::query()->delete();

            foreach ($validated['messages'] as $index => $message) {
                HeroMessage::create([
                    'language' => $message['language'],
                    'direction' => $message['direction'],
                    'title' => $message['title'],
                    'description' => $message['description'],
                    'primary_action_label' => $message['primaryAction']['label'],
                    'primary_action_href' => $message['primaryAction']['href'],
                    'secondary_action_label' => $message['secondaryAction']['label'] ?? null,
                    'secondary_action_href' => $message['secondaryAction']['href'] ?? null,
                    'is_active' => true,
                    'sort_order' => $index,
                ]);
            }
        });

        return response()->json(['message' => 'Messages du hero enregistrés avec succès.']);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    protected function actionMessage(string $action): string
    {
        return match ($action) {
            'activate' => 'Annonces activées.',
            'deactivate' => 'Annonces désactivées.',
            'delete' => 'Annonces supprimées.',
        };
    }

    protected function listingActionMessage(string $action): string
    {
        return match ($action) {
            'activate' => 'Annonce activée.',
            'deactivate' => 'Annonce désactivée.',
            'delete' => 'Annonce supprimée.',
        };
    }


}