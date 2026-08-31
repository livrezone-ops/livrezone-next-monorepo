<?php

namespace App\Http\Controllers\Profile;

use App\Http\Controllers\Controller;
use App\Models\NotificationPreference;
use App\Models\User;
use App\Services\NotificationTypeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PreferenceController extends Controller
{
    /**
     * Canaux EXTERNES paramétrables par l'utilisateur. Le canal interne
     * (`in_app`) n'y figure pas : les notifications internes de la plateforme
     * sont toujours actives et ne peuvent pas être désactivées. La messagerie
     * interne (chat) n'est pas un canal de notification et ne reçoit jamais
     * aucun envoi : elle reste exclusivement dédiée aux échanges entre
     * utilisateurs.
     */
    public const EXTERNAL_CHANNELS = ['email', 'telegram', 'whatsapp'];

    /**
     * État complet du paramétrage des notifications (page /notifications/parametrage).
     *
     * - channels : canaux externes activés (email, telegram, whatsapp) ;
     * - types : types de notifications à recevoir (registre
     *   NotificationTypeService, extensible sans refonte) ;
     * - categories : catégories parent / centres d'intérêt souhaités
     *   (filtre optionnel ; la liste disponible est servie par /reference-data,
     *   déjà consommé par le front via `parent_categories`).
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $prefs = $user->notificationPreferences;

        // Canaux externes : préférence absente => activé par défaut.
        $channels = [];
        foreach (self::EXTERNAL_CHANNELS as $channel) {
            $channels[$channel] = $prefs
                ->where('notification_type', 'book_orders')
                ->where('channel', $channel)
                ->first()?->is_enabled ?? true;
        }

        // Types de notifications (les canaux externes partagent la clé
        // `book_orders` pour le filtrage par catégorie côté jobs).
        $types = [];
        foreach (NotificationTypeService::keys() as $type) {
            $types[$type] = $prefs
                ->where('notification_type', $type)
                ->where('channel', 'email')
                ->first()?->is_enabled ?? true;
        }

        // Catégories parent souhaitées (filtres de la pref email book_orders).
        $categories = $prefs
            ->where('notification_type', 'book_orders')
            ->where('channel', 'email')
            ->first()?->filters['categories'] ?? [];

        return response()->json([
            'channels' => $channels,
            'types' => $types,
            'categories' => array_values(array_map('intval', $categories)),
            'telegram' => $this->telegramState($user),
        ]);
    }

    /**
     * Enregistre le paramétrage : canaux externes (S1), types de notifications
     * (S2) et catégories parent (S2). Le canal in-app n'est jamais écrit ni lu :
     * les notifications internes restent toujours actives.
     */
    public function update(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'channels' => ['sometimes', 'array'],
            'channels.*' => ['boolean'],
            'types' => ['sometimes', 'array'],
            'types.*' => ['boolean'],
            'categories' => ['sometimes', 'array'],
            'categories.*' => ['integer', Rule::exists('categories', 'id')],
        ]);

        // Canaux externes uniquement : toute clé in_app envoyée est ignorée.
        $channels = array_intersect_key(
            $validated['channels'] ?? [],
            array_flip(self::EXTERNAL_CHANNELS)
        );
        $types = $validated['types'] ?? [];
        $categoryIds = array_values(array_unique(array_map('intval', $validated['categories'] ?? [])));

        DB::transaction(function () use ($user, $channels, $types, $categoryIds) {
            // Produit cartésien types x canaux externes : un type est reçu sur
            // un canal si le type ET le canal sont activés. Matrice compatible
            // avec la lecture des jobs (pref book_orders/canal pour les envois
            // demandes, pref type/email pour les futurs senders).
            foreach ($types as $type => $enabled) {
                if (! in_array((string) $type, NotificationTypeService::keys(), true)) {
                    continue; // Type inconnu du registre : ignoré (extensible)
                }
                foreach (self::EXTERNAL_CHANNELS as $channel) {
                    $this->upsertPref(
                        (int) $user->id,
                        (string) $type,
                        $channel,
                        (bool) $enabled && ($channels[$channel] ?? true)
                    );
                }
            }

            // Filtre catégories parent : partagé par les canaux externes
            // (consulté par ProcessBookOrderNotifications / NotifyDemanders).
            if (array_key_exists('categories', $validated)) {
                foreach (self::EXTERNAL_CHANNELS as $channel) {
                    $pref = NotificationPreference::firstOrNew([
                        'user_id' => $user->id,
                        'notification_type' => 'book_orders',
                        'channel' => $channel,
                    ]);
                    $filters = is_array($pref->filters) ? $pref->filters : [];
                    $filters['categories'] = $categoryIds;
                    $pref->filters = $filters;
                    if ($pref->is_enabled === null) {
                        $pref->is_enabled = true;
                    }
                    $pref->save();
                }
            }
        });

        return response()->json($this->index($request)->getData(assoc: true));
    }

    /**
     * État de la liaison Telegram de l'utilisateur (section 3 du paramétrage).
     * La connexion / vérification / déconnexion restent gérées par les
     * endpoints dédiés (profile/telegram/link + webhook Telegram).
     *
     * @return array<string, mixed>
     */
    protected function telegramState(User $user): array
    {
        $profile = $user->profile;

        return [
            'connected' => ! empty($profile?->telegram_id),
            'chat_id' => $profile?->telegram_id,
        ];
    }

    /**
     * Crée ou met à jour une préférence (unique user_id + type + canal).
     */
    protected function upsertPref(int $userId, string $type, string $channel, bool $enabled): void
    {
        NotificationPreference::updateOrCreate(
            [
                'user_id' => $userId,
                'notification_type' => $type,
                'channel' => $channel,
            ],
            ['is_enabled' => $enabled],
        );
    }
}
