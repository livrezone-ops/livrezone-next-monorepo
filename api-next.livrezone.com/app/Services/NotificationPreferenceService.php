<?php

namespace App\Services;

use App\Models\NotificationPreference;
use Illuminate\Database\Eloquent\Collection;

class NotificationPreferenceService
{
    public const ALLOWED_TYPES = ['book_orders', 'newsletter', 'promos'];

    public const ALLOWED_CHANNELS = ['email', 'in_app', 'telegram'];

    /**
     * Récupère les préférences de notification d'un utilisateur.
     */
    public function getForUser(int $userId): Collection
    {
        return NotificationPreference::where('user_id', $userId)->get();
    }

    /**
     * Met à jour (upsert) les préférences de notification d'un utilisateur.
     * Les types et canaux sont déjà validés par le contrôleur.
     *
     * @param  array<int, array{notification_type: string, channel: string, is_enabled: bool, filters?: array|null}>  $preferences
     */
    public function updateForUser(int $userId, array $preferences): Collection
    {
        foreach ($preferences as $pref) {
            NotificationPreference::updateOrCreate(
                [
                    'user_id' => $userId,
                    'notification_type' => $pref['notification_type'],
                    'channel' => $pref['channel'],
                ],
                [
                    'is_enabled' => $pref['is_enabled'],
                    'filters' => $pref['filters'] ?? null,
                ]
            );
        }

        return $this->getForUser($userId);
    }
}
