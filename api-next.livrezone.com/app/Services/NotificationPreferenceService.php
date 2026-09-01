<?php

namespace App\Services;

use App\Models\NotificationPreference;
use App\Support\NotificationChannels;
use Illuminate\Database\Eloquent\Collection;

class NotificationPreferenceService
{
    /**
     * Types de notifications autorisés dans les préférences.
     * Délègue au registre central : aucune divergence possible.
     */
    public static function allowedTypes(): array
    {
        return NotificationTypeService::keys();
    }

    /**
     * Canaux externes autorisés dans les préférences (email, telegram,
     * whatsapp). Le canal interne (in-app) n'est PAS une préférence :
     * les notifications internes sont toujours actives (règle produit).
     */
    public static function allowedChannels(): array
    {
        return [
            NotificationChannels::PREF_EMAIL,
            NotificationChannels::PREF_TELEGRAM,
            NotificationChannels::PREF_WHATSAPP,
        ];
    }

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
