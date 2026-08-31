<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\NotificationTypeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class NotificationController extends Controller
{
    /**
     * Liste paginée des notifications in-app (canal database) de l'utilisateur,
     * avec le nombre de non-lues.
     *
     * Filtre optionnel `?type=` (clé du registre NotificationTypeService) :
     * filtre sur `data->type` (clé métier stockée à l'émission par les
     * notifications Laravel). La liste des types filtrables est renvoyée dans
     * `meta.types` pour que le front reste synchronisé (extensibilité).
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['nullable', 'string', Rule::in(NotificationTypeService::keys())],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $user = $request->user();

        // Relation User::notifications() : épinglées d'abord, puis par date.
        // Les notifications masquées (dismissed_at) sont exclues de la liste.
        // `pinned_at IS NULL` : 0 pour les épinglées → elles trient en tête
        // quelle que soit leur ancienneté (le tri front ne couvre qu'une page).
        $query = $user->notifications()
            ->visible()
            ->orderByRaw('pinned_at IS NULL')
            ->orderByDesc('created_at');

        if (! empty($validated['type'])) {
            $query->where('data->type', $validated['type']);
        }

        $notifications = $query->paginate(15);

        return response()->json([
            'notifications' => $notifications->items(),
            'meta' => [
                'current_page' => $notifications->currentPage(),
                'last_page' => $notifications->lastPage(),
                'total' => $notifications->total(),
                'unread_count' => $user->notifications()
                    ->visible()
                    ->whereNull('read_at')
                    ->count(),
                'types' => NotificationTypeService::labels(),
            ],
        ]);
    }

    /**
     * Épingle / désépingle une notification (toggle).
     */
    public function togglePin(Request $request, string $id): JsonResponse
    {
        $notification = $request->user()->notifications()->where('id', $id)->firstOrFail();

        $notification->forceFill([
            'pinned_at' => $notification->pinned_at === null ? now() : null,
        ])->save();

        return response()->json([
            'message' => $notification->pinned_at ? 'Notification épinglée.' : 'Notification désépinglée.',
            'pinned_at' => $notification->pinned_at?->toIso8601String(),
        ]);
    }

    /**
     * Masque une notification (sort de la liste sans être supprimée).
     */
    public function hide(Request $request, string $id): JsonResponse
    {
        $notification = $request->user()->notifications()->where('id', $id)->firstOrFail();

        $notification->forceFill(['dismissed_at' => now()])->save();

        return response()->json(['message' => 'Notification masquée.']);
    }

    /**
     * Marque une notification comme lue (appartenant à l'utilisateur).
     */
    public function markRead(Request $request, string $id): JsonResponse
    {
        $notification = $request->user()
            ->notifications()
            ->where('id', $id)
            ->first();

        if (! $notification) {
            return response()->json(['message' => 'Notification introuvable.'], 404);
        }

        if (! $notification->read_at) {
            $notification->markAsRead();
        }

        return response()->json([
            'message' => 'Notification marquée comme lue.',
            'unread_count' => $request->user()->notifications()->visible()->whereNull('read_at')->count(),
        ]);
    }

    /**
     * Marque toutes les notifications comme lues.
     */
    public function markAllRead(Request $request): JsonResponse
    {
        // Seules les notifications visibles sont marquées lues (les masquées
        // sont déjà hors boîte de réception et de compteurs).
        $request->user()->notifications()->visible()->whereNull('read_at')->update(['read_at' => now()]);

        return response()->json([
            'message' => 'Toutes les notifications ont été marquées comme lues.',
            'unread_count' => 0,
        ]);
    }
}
