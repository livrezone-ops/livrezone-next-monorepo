<?php

namespace App\Services;

use App\Models\Listing;
use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class AdminDashboardService
{
    // Un utilisateur est considéré « connecté » si sa dernière activité
    // de session remonte à moins de cette durée (en secondes).
    protected const ONLINE_WINDOW_SECONDS = 300; // 5 minutes

    public function getUsersList(array $data): array
    {
        Validator::make($data, [
            'search' => 'nullable|string|max:100',
            'status' => ['nullable', Rule::in(['all', 'active', 'inactive'])],
            'connection' => ['nullable', Rule::in(['all', 'online', 'offline'])],
            'sort_by' => ['nullable', Rule::in(['created_at', 'name', 'email', 'last_activity'])],
            'sort_dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'limit' => 'nullable|integer',
        ])->validate();

        $status = $data['status'] ?? 'all';
        $connection = $data['connection'] ?? 'all';

        $query = User::query()->with('profile.city');

        if ($status === 'active') {
            $query->where('is_active', true);
        } elseif ($status === 'inactive') {
            $query->where('is_active', false);
        }

        // Filtre connexion (en ligne / hors ligne) basé sur la dernière activité
        // (heartbeat), repli sur last_login_at. Même fenêtre que le compteur en ligne.
        $activityWindow = now()->subSeconds(static::ONLINE_WINDOW_SECONDS);
        if ($connection === 'online') {
            $query->whereRaw('COALESCE(last_activity_at, last_login_at) >= ?', [$activityWindow]);
        } elseif ($connection === 'offline') {
            $query->whereRaw(
                'COALESCE(last_activity_at, last_login_at) IS NULL OR COALESCE(last_activity_at, last_login_at) < ?',
                [$activityWindow]
            );
        }

        if (!empty($data['search'])) {
            $search = $data['search'];
            $query->where(function ($q) use ($search) {
                $q->where('users.name', 'like', "%{$search}%")
                  ->orWhere('users.email', 'like', "%{$search}%")
                  ->orWhereHas('profile', function ($pq) use ($search) {
                      $pq->where('nickname', 'like', "%{$search}%");
                  });
            });
        }

        $sortBy = $data['sort_by'] ?? 'created_at';
        $sortDir = $data['sort_dir'] ?? 'desc';
        $query->orderBy($sortBy, $sortDir);

        $limit = isset($data['limit']) ? (int) $data['limit'] : 20;
        $users = $query->paginate($limit);

        // Comptage groupé des annonces par utilisateur (évite le N+1).
        $userIds = $users->getCollection()->pluck('id')->all();
        $listingsCounts = Listing::query()
            ->whereIn('user_id', $userIds)
            ->groupBy('user_id')
            ->selectRaw('user_id, COUNT(*) as cnt')
            ->pluck('cnt', 'user_id');

        // Transformation : on transmet ici le statut « en ligne » via User::isOnline()
        // (et non plus un calcul inline) pour rester cohérent avec /api/user.
        $items = $users->getCollection()->map(function (User $user) use ($listingsCounts) {
            return [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'is_admin' => $user->is_admin,
                'is_active' => $user->is_active,
                'profile' => $user->profile,
                'listings_count' => (int) ($listingsCounts[$user->id] ?? 0),
                'last_login_at' => $user->last_login_at,
                'connection' => [
                    'online' => $user->isOnline(),
                    'last_activity' => ($user->last_activity_at ?? $user->last_login_at)?->timestamp,
                    'last_ip' => null,
                    'active_sessions' => 0,
                ],
                'created_at' => $user->created_at,
            ];
        });

        return [
            'users' => $items->values()->all(),
            'meta' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'total' => $users->total(),
                'active_count' => User::where('is_active', true)->count(),
                'inactive_count' => User::where('is_active', false)->count(),
                'online_count' => $this->onlineUserCount(),
            ],
        ];
    }

    protected function onlineUserCount(): int
    {
        return User::whereRaw('COALESCE(last_activity_at, last_login_at) >= ?', [
            now()->subSeconds(static::ONLINE_WINDOW_SECONDS),
        ])->count();
    }
}
