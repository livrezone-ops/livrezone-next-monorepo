<?php

namespace App\Services;

use App\Models\NotificationPreference;
use App\Support\NotificationChannels;
use Illuminate\Support\Facades\DB;

/**
 * Sauvegarde du paramétrage des notifications (S1 canaux externes ×
 * S2 types + catégories), en une seule transaction atomique.
 *
 * Matrice type×canal recalculée :
 * - email/telegram × tous les types du registre ;
 * - whatsapp uniquement pour book_orders (réservé aux notifications de
 *   demandes de livres) ;
 * - les canaux internes (in-app) ne sont jamais écrits : les
 *   notifications internes sont toujours actives (règle produit).
 */
class NotificationSettingsService
{
    public function __construct(
        private readonly NotificationPreferenceService $preferences,
    ) {}

    /**
     * @param  array{channels: array{email: bool, telegram: bool, whatsapp: bool}, types: array<string, bool>, categories: int[]}  $settings
     */
    public function save(int $userId, array $settings): void
    {
        $typeKeys = NotificationTypeService::keys();
        $channels = $settings['channels'];
        $categories = $settings['categories'];

        $types = array_fill_keys($typeKeys, false);
        foreach ($settings['types'] as $key => $enabled) {
            $types[$key] = (bool) $enabled;
        }

        DB::transaction(function () use ($userId, $typeKeys, $types, $channels, $categories): void {
            $rows = [];
            foreach ($typeKeys as $type) {
                foreach ([NotificationChannels::PREF_EMAIL, NotificationChannels::PREF_TELEGRAM] as $channel) {
                    $rows[] = [
                        'notification_type' => $type,
                        'channel' => $channel,
                        'is_enabled' => $types[$type] && $channels[$channel],
                        'filters' => $type === 'book_orders' && $categories !== []
                            ? ['categories' => $categories]
                            : null,
                    ];
                }
            }
            // WhatsApp : réservé aux notifications de demandes de livres.
            $rows[] = [
                'notification_type' => 'book_orders',
                'channel' => NotificationChannels::PREF_WHATSAPP,
                'is_enabled' => $types['book_orders'] && $channels[NotificationChannels::PREF_WHATSAPP],
                'filters' => $categories !== [] ? ['categories' => $categories] : null,
            ];

            $this->preferences->updateForUser($userId, $rows);

            // Purge des lignes hors matrice (in_app historique, whatsapp sur
            // d'autres types) pour garder la table cohérente avec le modèle.
            NotificationPreference::where('user_id', $userId)
                ->where(function ($q): void {
                    $q->where('channel', NotificationChannels::PREF_IN_APP)
                        ->orWhere(function ($q2): void {
                            $q2->where('channel', NotificationChannels::PREF_WHATSAPP)
                                ->where('notification_type', '!=', 'book_orders');
                        });
                })
                ->delete();
        });
    }
}
