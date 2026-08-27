<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\DashboardBulkStatusRequest;
use App\Models\Listing;
use App\Services\ListingQueryService;
use App\Services\ListingValidationService;
use App\Services\TelegramNotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class DashboardController extends Controller
{
    public function __construct(
        protected ListingQueryService $listingQueryService,
        protected ListingValidationService $validationService,
        protected TelegramNotificationService $telegram,
    ) {}

    public function index(Request $request)
    {
        $validated = $request->validate([
            'filter' => ['nullable', Rule::in(['online', 'offline', 'all'])],
            'search' => 'nullable|string|max:100',
            'sort_by' => ['nullable', Rule::in(['created_at', 'price', 'title'])],
            'sort_dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'limit' => 'nullable|integer|min:1|max:100',
        ]);

        $result = $this->listingQueryService->listForSeller(
            $request->user()->id,
            $validated
        );

        return response()->json($result);
    }

    public function updateInline(Request $request, Listing $listing)
    {
        if (! $request->user()->can('update', $listing)) {
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
        if (! $request->user()->can('update', $listing)) {
            abort(403);
        }

        // Un vendeur ne peut jamais publier/valider lui-même : statuts limités.
        $validated = $request->validate([
            'status' => ['required', Rule::in(ListingQueryService::SELLER_STATUSES)],
        ]);

        $status = $validated['status'];

        // Un listing ne peut être marqué vendu/supprimé/archivé qu'une seule fois.
        // Toute répétition d'une action déjà effectuée est ignorée et signalée.
        if ($listing->status === $status) {
            return response()->json([
                'message' => match ($status) {
                    'sold' => 'Article déjà vendu',
                    'deleted' => 'Article déjà supprimé',
                    'archived' => 'Article déjà archivé',
                },
                'listing' => $listing,
            ], 409);
        }

        $listing->update(['status' => $status]);

        return response()->json([
            'message' => match ($status) {
                'sold' => 'Article marqué comme vendu avec succès',
                'deleted' => 'Article supprimé avec succès',
                'archived' => 'Article archivé avec succès',
            },
            'listing' => $listing,
        ]);
    }

    /**
     * Republie une annonce en créant une copie reprenant toutes ses
     * caractéristiques. L'annonce d'origine est conservée pour l'historique.
     * Le statut final (published ou pending_admin) est décidé par la
     * modération, jamais par le vendeur.
     */
    public function republish(Request $request, Listing $listing)
    {
        if (! $request->user()->can('update', $listing)) {
            abort(403);
        }

        $status = $this->validationService->determineRepublishStatus($listing);

        $newListing = $listing->replicate();
        $newListing->status = $status;
        $newListing->submitted_at = now();
        $newListing->reviewed_at = null;
        $newListing->reviewed_by = null;
        $newListing->moderation_note = null;
        $newListing->published_at = ($status === 'published') ? now() : null;
        $newListing->deleted_at = null;
        $newListing->save();

        try {
            $this->telegram->notifyAdminNewListing($newListing);
        } catch (\Exception $e) {
            Log::error('Erreur envoi Telegram republish: '.$e->getMessage());
        }

        return response()->json([
            'message' => ($status === 'published')
                ? 'Article republié et mis en ligne avec succès'
                : 'Article republié avec succès, en attente de validation',
            'listing' => $newListing,
        ], 201);
    }

    public function bulkUpdateStatus(DashboardBulkStatusRequest $request)
    {
        $ids = array_map('intval', (array) $request->input('ids', []));

        $updated = $this->listingQueryService->bulkUpdateForSeller(
            $request->user()->id,
            $ids,
            (string) $request->input('status')
        );

        return response()->json([
            'message' => 'Annonces mises à jour',
            'updated' => $updated,
        ]);
    }

    public function bulkApplyDiscount(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:listings,id',
            'discount_percentage' => 'required|numeric|min:1|max:99',
        ]);

        $updated = $this->listingQueryService->applyDiscountForSeller(
            $request->user()->id,
            $validated['ids'],
            (float) $validated['discount_percentage']
        );

        return response()->json([
            'message' => 'Remises appliquées',
            'updated' => $updated,
        ]);
    }
}
