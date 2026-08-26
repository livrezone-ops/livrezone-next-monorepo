<?php

namespace App\Services;

use App\Models\Listing;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * Service centralisé de listing d'annonces (vendeur + admin).
 *
 * Règles de sécurité :
 * - Le périmètre vendeur est TOUJOURS forcé par le paramètre $userId (jamais par la requête).
 * - Les statuts modifiables par un vendeur sont strictement limités à SELLER_STATUSES ;
 *   la validation/modération (published, pending_admin...) reste réservée à l'admin.
 */
class ListingQueryService
{
    /** Statuts qu'un vendeur peut appliquer à SES annonces uniquement. */
    public const SELLER_STATUSES = ['sold', 'deleted', 'archived'];

    /** Actions administrateur autorisées. */
    public const ADMIN_ACTIONS = ['activate', 'deactivate', 'delete'];

    private const SORTABLE_COLUMNS = ['created_at', 'price', 'title'];

    /** Filtres admin -> statuts SQL. */
    private const ADMIN_FILTERS = [
        'online' => ['published', 'active'],
        'offline' => ['hidden', 'expired', 'sold'],
        'pending' => ['pending_admin'],
        'archived' => ['archived'],
        'deleted' => ['deleted'],
    ];

    /**
     * Liste paginée des annonces d'un vendeur (périmètre forcé).
     *
     * @return array{listings: LengthAwarePaginator, meta: array}
     */
    public function listForSeller(int $userId, array $filters): array
    {
        $filter = $filters['filter'] ?? 'online';

        $query = match ($filter) {
            'online' => Listing::getActiveListingsByUser($userId),
            'offline' => Listing::getDesactivatedListingsByUser($userId),
            default => Listing::getListingsByUser($userId),
        };

        $this->applySearch($query, $filters['search'] ?? null);
        $this->applySort($query, $filters);

        $listings = $query->with(['book', 'category'])->paginate($filters['limit'] ?? 8);

        return [
            'listings' => $listings->items(),
            'meta' => [
                'current_page' => $listings->currentPage(),
                'last_page' => $listings->lastPage(),
                'total' => $listings->total(),
                'active_count' => Listing::getActiveListingsByUser($userId)->count(),
                'sold_count' => Listing::where('user_id', $userId)->where('status', 'sold')->count(),
            ],
        ];
    }

    /**
     * Liste paginée globale des annonces (admin).
     *
     * @return array{listings: LengthAwarePaginator, meta: array}
     */
    public function listForAdmin(array $filters): array
    {
        $query = Listing::query()->with(['book', 'category', 'user.profile']);

        $statuses = self::ADMIN_FILTERS[$filters['filter'] ?? 'all'] ?? null;
        if ($statuses !== null) {
            $query->whereIn('status', $statuses);
        }

        $this->applyAdminSearch($query, $filters['search'] ?? null);
        $this->applySort($query, $filters);

        $listings = $query->paginate($filters['limit'] ?? 20);

        return [
            'listings' => $listings->items(),
            'meta' => [
                'current_page' => $listings->currentPage(),
                'last_page' => $listings->lastPage(),
                'total' => $listings->total(),
                'status_counts' => $this->statusCounts(),
            ],
        ];
    }

    /**
     * Changement de statut en masse pour LES ANNONCES D'UN VENDEUR UNIQUEMENT.
     * Les ids n'appartenant pas au vendeur sont silencieusement ignorés.
     */
    public function bulkUpdateForSeller(int $userId, array $ids, string $status): int
    {
        return Listing::whereIn('id', $ids)
            ->where('user_id', $userId)
            ->whereNotIn('status', [$status])
            ->update(['status' => $status]);
    }

    /**
     * Remise en pourcentage sur les annonces du vendeur.
     */
    public function applyDiscountForSeller(int $userId, array $ids, float $percentage): int
    {
        $listings = Listing::whereIn('id', $ids)
            ->where('user_id', $userId)
            ->get(['id', 'price']);

        foreach ($listings as $listing) {
            $listing->update([
                'discount_price' => round($listing->price * (1 - ($percentage / 100)), 2),
            ]);
        }

        return $listings->count();
    }

    /** Compteurs de statuts globaux (une seule requête GROUP BY). */
    public function statusCounts(): array
    {
        $counts = Listing::query()
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return [
            'online' => (int) ($counts['published'] ?? 0) + (int) ($counts['active'] ?? 0),
            'offline' => (int) ($counts['hidden'] ?? 0) + (int) ($counts['expired'] ?? 0) + (int) ($counts['sold'] ?? 0),
            'pending' => (int) ($counts['pending_admin'] ?? 0),
            'archived' => (int) ($counts['archived'] ?? 0),
            'deleted' => (int) ($counts['deleted'] ?? 0),
        ];
    }

    private function applySearch($query, ?string $search): void
    {
        if (! $search) {
            return;
        }

        $query->where(function ($q) use ($search) {
            $q->where('title', 'like', "%{$search}%")
                ->orWhere('isbn_13', 'like', "%{$search}%");
        });
    }

    private function applyAdminSearch($query, ?string $search): void
    {
        if (! $search) {
            return;
        }

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

    private function applySort($query, array $filters): void
    {
        $sortBy = in_array($filters['sort_by'] ?? null, self::SORTABLE_COLUMNS, true)
            ? $filters['sort_by']
            : 'created_at';
        $sortDir = ($filters['sort_dir'] ?? 'desc') === 'asc' ? 'asc' : 'desc';

        $query->orderBy($sortBy, $sortDir);
    }
}
