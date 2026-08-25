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

    public function __construct(
        protected \App\Services\ListingQueryService $listingQueryService,
    ) {
    }

    public function listings(Request $request)
    {
        $validated = $request->validate([
            'filter' => ['nullable', Rule::in(['all', 'online', 'offline', 'pending', 'archived', 'deleted'])],
            'search' => 'nullable|string|max:100',
            'sort_by' => ['nullable', Rule::in(['created_at', 'price', 'title'])],
            'sort_dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'limit' => 'nullable|integer|min:1|max:100',
        ]);

        return response()->json(
            $this->listingQueryService->listForAdmin($validated)
        );
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
            'action' => ['required', Rule::in(\App\Services\ListingQueryService::ADMIN_ACTIONS)],
        ]);

        $newStatus = match ($validated['action']) {
            'activate' => 'published',
            'deactivate' => 'hidden',
            'delete' => 'deleted',
        };

        $updated = Listing::whereIn('id', $validated['ids'])->update(['status' => $newStatus]);

        return response()->json([
            'message' => $this->actionMessage($validated['action']),
            'updated' => $updated,
        ]);
    }

    // ------------------------------------------------------------------
    // Demandes (book requests)
    // ------------------------------------------------------------------

    public function orders(Request $request)
    {
        $validated = $request->validate([
            'status' => ['nullable', Rule::in(['all', 'pending_admin', 'published', 'fulfilled', 'cancelled', 'rejected'])],
            'search' => 'nullable|string|max:100',
            'sort_by' => ['nullable', Rule::in(['created_at', 'title'])],
            'sort_dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'limit' => 'nullable|integer|min:1|max:100',
        ]);

        return response()->json(
            app(\App\Services\OrderService::class)->listForAdmin($validated)
        );
    }

    public function updateOrderStatus(Request $request, \App\Models\Order $order)
    {
        $validated = $request->validate([
            'action' => ['required', Rule::in(['publish', 'reject', 'fulfill'])],
        ]);

        match ($validated['action']) {
            'publish' => $order->update(['status' => 'published', 'published_at' => now()]),
            'reject' => $order->update(['status' => 'rejected']),
            'fulfill' => $order->update(['status' => 'fulfilled']),
        };

        return response()->json([
            'message' => match ($validated['action']) {
                'publish' => 'Demande publiée.',
                'reject' => 'Demande rejetée.',
                'fulfill' => 'Demande marquée comme satisfaite.',
            },
            'order' => ['id' => $order->id, 'status' => $order->status],
        ]);
    }

    // ------------------------------------------------------------------
    // Paiements, échéances, promo, codes de réduction
    // ------------------------------------------------------------------

    public function payments(Request $request)
    {
        $validated = $request->validate([
            'status' => ['nullable', Rule::in(['all', 'pending', 'paid', 'failed'])],
            'type' => ['nullable', Rule::in(['all', 'pro', 'premium'])],
            'expiring' => 'nullable|boolean',
            'search' => 'nullable|string|max:100',
            'sort_by' => ['nullable', Rule::in(['created_at', 'expires_at', 'amount'])],
            'sort_dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'limit' => 'nullable|integer|min:1|max:100',
        ]);

        return response()->json(
            app(\App\Services\AdminPaymentService::class)->list($validated)
        );
    }

    public function promoState(\App\Services\SubscriptionService $subscriptions)
    {
        return response()->json([
            'promo_pro_free' => $subscriptions->isPromoProFree(),
        ]);
    }

    public function togglePromo(Request $request, \App\Services\SubscriptionService $subscriptions)
    {
        $validated = $request->validate([
            'active' => 'required|boolean',
        ]);

        $subscriptions->setPromoProFree($validated['active']);

        return response()->json([
            'message' => $validated['active']
                ? 'Promo activée : les comptes free bénéficient des avantages Pro.'
                : 'Promo désactivée.',
            'promo_pro_free' => $validated['active'],
        ]);
    }

    public function discountCodes()
    {
        return response()->json([
            'codes' => app(\App\Services\AdminPaymentService::class)->listDiscountCodes(),
        ]);
    }

    public function storeDiscountCode(Request $request)
    {
        $validated = $request->validate([
            'code' => 'required|string|min:3|max:30|regex:/^[A-Za-z0-9_-]+$/',
            'type' => ['required', Rule::in(['percent', 'fixed'])],
            'value' => 'required|numeric|min:0.01',
            'is_active' => 'nullable|boolean',
            'expires_at' => 'nullable|date|after:now',
            'max_uses' => 'nullable|integer|min:1',
        ]);

        try {
            $code = app(\App\Services\AdminPaymentService::class)->createDiscountCode($validated);
        } catch (\Illuminate\Database\QueryException) {
            return response()->json(['message' => 'Ce code existe déjà.'], 422);
        }

        return response()->json(['message' => "Code {$code->code} créé.", 'code' => $code], 201);
    }

    public function updateDiscountCode(Request $request, \App\Models\DiscountCode $discountCode)
    {
        $validated = $request->validate([
            'code' => 'sometimes|string|min:3|max:30|regex:/^[A-Za-z0-9_-]+$/',
            'type' => ['sometimes', Rule::in(['percent', 'fixed'])],
            'value' => 'sometimes|numeric|min:0.01',
            'is_active' => 'sometimes|boolean',
            'expires_at' => 'nullable|date',
            'max_uses' => 'nullable|integer|min:1',
        ]);

        $code = app(\App\Services\AdminPaymentService::class)->updateDiscountCode($discountCode, $validated);

        return response()->json(['message' => 'Code mis à jour.', 'code' => $code]);
    }

    public function destroyDiscountCode(\App\Models\DiscountCode $discountCode)
    {
        $discountCode->delete();

        return response()->json(['message' => 'Code supprimé.']);
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