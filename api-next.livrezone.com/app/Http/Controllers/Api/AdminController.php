<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\AdminBulkListingStatusRequest;
use App\Http\Requests\Api\AdminListingsIndexRequest;
use App\Http\Requests\Api\AdminOrdersIndexRequest;
use App\Http\Requests\Api\AdminPaymentsIndexRequest;
use App\Http\Requests\Api\AdminStoreDiscountCodeRequest;
use App\Http\Requests\Api\AdminStoreHeroRequest;
use App\Http\Requests\Api\AdminTogglePromoRequest;
use App\Http\Requests\Api\AdminUpdateDiscountCodeRequest;
use App\Http\Requests\Api\AdminUpdateListingStatusRequest;
use App\Http\Requests\Api\AdminUpdateOrderStatusRequest;
use App\Http\Requests\Api\AdminUpdateSettingsRequest;
use App\Http\Requests\Api\AdminUpdateUserStatusRequest;
use App\Http\Requests\Api\AdminUpdateUserSubscriptionRequest;
use App\Jobs\NotifyDemandersOnListingPublished;
use App\Models\DiscountCode;
use App\Models\HeroMessage;
use App\Models\Listing;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Services\AdminDashboardService;
use App\Services\AdminPaymentService;
use App\Services\ListingQueryService;
use App\Services\OrderService;
use App\Services\SubscriptionService;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    // ------------------------------------------------------------------
    // Utilisateurs
    // ------------------------------------------------------------------

    public function users(Request $request, AdminDashboardService $adminService)
    {
        return response()->json($adminService->getUsersList($request->all()));
    }

    public function updateUserStatus(AdminUpdateUserStatusRequest $request, User $user)
    {
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Vous ne pouvez pas modifier votre propre statut.'], 422);
        }

        $validated = $request->validated();

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
    public function updateUserSubscription(AdminUpdateUserSubscriptionRequest $request, User $user)
    {
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Vous ne pouvez pas modifier votre propre abonnement.'], 422);
        }

        $validated = $request->validated();

        $profile = app(SubscriptionService::class)
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
        protected ListingQueryService $listingQueryService,
    ) {}

    public function listings(AdminListingsIndexRequest $request)
    {
        $validated = $request->validated();

        return response()->json(
            $this->listingQueryService->listForAdmin($validated)
        );
    }

    public function updateListingStatus(AdminUpdateListingStatusRequest $request, Listing $listing)
    {
        $validated = $request->validated();

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

    public function bulkListingStatus(AdminBulkListingStatusRequest $request)
    {
        $validated = $request->validated();

        $newStatus = match ($validated['action']) {
            'activate' => 'published',
            'deactivate' => 'hidden',
            'delete' => 'deleted',
        };

        // Le mass update ne déclenche pas les événements modèle : on capture
        // les annonces qui passent réellement en "published" pour notifier
        // les demandeurs correspondants.
        $becomingPublished = $newStatus === 'published'
            ? Listing::whereIn('id', $validated['ids'])->where('status', '!=', 'published')->get()
            : collect();

        $updated = Listing::whereIn('id', $validated['ids'])->update(['status' => $newStatus]);

        foreach ($becomingPublished as $listing) {
            NotifyDemandersOnListingPublished::dispatch($listing);
        }

        return response()->json([
            'message' => $this->actionMessage($validated['action']),
            'updated' => $updated,
        ]);
    }

    // ------------------------------------------------------------------
    // Demandes (book requests)
    // ------------------------------------------------------------------

    public function orders(AdminOrdersIndexRequest $request)
    {
        $validated = $request->validated();

        return response()->json(
            app(OrderService::class)->listForAdmin($validated)
        );
    }

    public function updateOrderStatus(AdminUpdateOrderStatusRequest $request, Order $order)
    {
        $validated = $request->validated();

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

    public function payments(AdminPaymentsIndexRequest $request)
    {
        $validated = $request->validated();

        return response()->json(
            app(AdminPaymentService::class)->list($validated)
        );
    }

    public function promoState(SubscriptionService $subscriptions)
    {
        return response()->json([
            'promo_pro_free' => $subscriptions->isPromoProFree(),
        ]);
    }

    public function settings(SubscriptionService $subscriptions)
    {
        return response()->json([
            'settings' => $subscriptions->getEditableSettings(),
        ]);
    }

    public function updateSettings(AdminUpdateSettingsRequest $request, SubscriptionService $subscriptions)
    {
        $validated = $request->validated();

        // Empêche de désactiver TOUS les moyens de paiement d'un coup.
        $methods = ['method_virement', 'method_especes', 'method_cheque', 'method_autre'];
        $incoming = array_intersect_key($validated, array_flip($methods));
        if ($incoming !== []) {
            foreach ($methods as $m) {
                if (! array_key_exists($m, $validated)) {
                    // Champs non envoyés : conserver l'état actuel (DB, sinon .env).
                    $envKey = SubscriptionService::EDITABLE_SETTINGS[$m] ?? strtoupper($m);
                    $current = (int) (bool) $subscriptions->setting($m, $envKey, true);
                    $validated[$m] = (bool) $current;
                }
            }

            if (! in_array(true, array_map('boolval', array_intersect_key($validated, array_flip($methods))), true)) {
                throw ValidationException::withMessages([
                    'method_virement' => 'Au moins un moyen de paiement doit rester actif.',
                ]);
            }
        }

        foreach (array_filter($validated, fn ($v) => $v !== null) as $key => $value) {
            $subscriptions->setSetting($key, $value);
        }

        return response()->json([
            'message' => 'Réglages mis à jour.',
            'settings' => $subscriptions->getEditableSettings(),
        ]);
    }

    public function togglePromo(AdminTogglePromoRequest $request, SubscriptionService $subscriptions)
    {
        $validated = $request->validated();

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
            'codes' => app(AdminPaymentService::class)->listDiscountCodes(),
        ]);
    }

    public function storeDiscountCode(AdminStoreDiscountCodeRequest $request)
    {
        $validated = $request->validated();

        try {
            $code = app(AdminPaymentService::class)->createDiscountCode($validated);
        } catch (QueryException) {
            return response()->json(['message' => 'Ce code existe déjà.'], 422);
        }

        return response()->json(['message' => "Code {$code->code} créé.", 'code' => $code], 201);
    }

    public function updateDiscountCode(AdminUpdateDiscountCodeRequest $request, DiscountCode $discountCode)
    {
        $validated = $request->validated();

        $code = app(AdminPaymentService::class)->updateDiscountCode($discountCode, $validated);

        return response()->json(['message' => 'Code mis à jour.', 'code' => $code]);
    }

    public function destroyDiscountCode(DiscountCode $discountCode)
    {
        $discountCode->delete();

        return response()->json(['message' => 'Code supprimé.']);
    }

    public function pauseSubscription(Request $request, User $user, SubscriptionService $subscriptions)
    {
        $profile = $subscriptions->pauseSubscription($user);

        return response()->json([
            'message' => 'Abonnement mis en pause (plan gratuit). Offre d\'origine mémorisée.',
            'profile' => ['id' => $profile->id, 'subscription_type' => $profile->subscription_type, 'paused_from_type' => $profile->paused_from_type],
        ]);
    }

    public function resumeSubscription(Request $request, User $user, SubscriptionService $subscriptions)
    {
        $profile = $subscriptions->resumeSubscription($user);

        return response()->json([
            'message' => 'Abonnement repris : '.strtoupper($profile->subscription_type).'.',
            'profile' => ['id' => $profile->id, 'subscription_type' => $profile->subscription_type, 'paused_from_type' => null],
        ]);
    }

    public function markPaymentPaid(Request $request, Payment $payment)
    {
        $updated = app(AdminPaymentService::class)->markPaid($payment);

        return response()->json([
            'message' => 'Paiement validé. Abonnement '.$updated->subscription_type.' actif jusqu\'au '.
                ($updated->expires_at?->format('d/m/Y') ?? '—').'.',
            'payment' => [
                'id' => $updated->id,
                'status' => $updated->status,
                'expires_at' => $updated->expires_at?->toISOString(),
            ],
        ]);
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

    public function storeHero(AdminStoreHeroRequest $request)
    {
        $validated = $request->validated();

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
