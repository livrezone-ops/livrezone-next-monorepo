<?php

namespace App\Jobs;

use App\Models\Order;
use App\Models\Profile;
use App\Notifications\BookOrderedNotification;
use App\Services\NotificationContentService;
use App\Services\SubscriptionService;
use App\Services\TelegramNotificationService;
use App\Support\NotificationChannels;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessBookOrderNotifications implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $order;

    /**
     * Create a new job instance.
     */
    public function __construct(Order $order)
    {
        $this->order = $order;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $subscriptionService = app(SubscriptionService::class);

        // Vendeurs éligibles aux notifications (Free inclus si la promo est active)
        $sellers = Profile::with(['user', 'user.notificationPreferences'])
            ->whereIn('subscription_type', $subscriptionService->notifiableSubscriptionTypes())
            ->get();

        $delayHours = $subscriptionService->getNotificationDelayHours();

        foreach ($sellers as $profile) {
            $user = $profile->user;
            if (! $user) {
                continue;
            }

            // Free (hors promo) : aucune notification
            if (! $subscriptionService->canReceiveNotifications($profile)) {
                continue;
            }

            // Vérifier les préférences (si non défini, on suppose true par défaut pour tous les canaux)
            $prefs = $user->notificationPreferences->where('notification_type', 'book_orders');

            $wantsEmail = $prefs->where('channel', NotificationChannels::PREF_EMAIL)->first()?->is_enabled ?? true;
            $wantsTelegram = $prefs->where('channel', NotificationChannels::PREF_TELEGRAM)->first()?->is_enabled ?? true;

            // Règle produit : les notifications internes (in-app) sont TOUJOURS
            // actives et ne peuvent pas être désactivées par l'utilisateur.
            // La préférence historique `in_app` n'est plus consultée ici.

            // Vérifier le filtre de catégorie si présent
            $book = $this->order->book;
            $categoryId = $book?->default_category_id ?? $this->order->category_id;
            if ($categoryId) {
                // On prend les filtres du premier canal activé (supposant que les filtres sont partagés)
                $firstActivePref = $prefs->where('is_enabled', true)->first();
                $filters = $firstActivePref ? $firstActivePref->filters : null;

                if (is_array($filters) && isset($filters['categories']) && count($filters['categories']) > 0) {
                    if (! in_array($categoryId, $filters['categories'])) {
                        continue; // Ce vendeur ne veut pas être notifié pour cette catégorie
                    }
                }
            }

            // Canaux autorisés selon l'abonnement (centralisé dans SubscriptionService)
            $allowedChannels = $subscriptionService->allowedNotificationChannels($profile);
            $laravelChannels = [];
            $telegramChatId = null;

            if (in_array(NotificationChannels::DATABASE, $allowedChannels)) {
                // In-app toujours active (règle produit)
                $laravelChannels[] = NotificationChannels::DATABASE;
            }
            if (in_array(NotificationChannels::MAIL, $allowedChannels) && $wantsEmail) {
                $laravelChannels[] = NotificationChannels::MAIL;
            }
            if (in_array(NotificationChannels::TELEGRAM, $allowedChannels) && $wantsTelegram && $profile->telegram_id) {
                $telegramChatId = $profile->telegram_id;
            }

            if (count($laravelChannels) > 0) {
                $notification = new BookOrderedNotification($this->order, $laravelChannels);

                if ($subscriptionService->getEffectiveSubscription($profile) === 'pro') {
                    // Différé de X heures pour les comptes Pro (ou Free en promo)
                    $user->notify($notification->delay(now()->addHours($delayHours)));
                } else {
                    // Premium = Immédiat
                    $user->notify($notification);
                }
            }

            if ($telegramChatId) {
                // Texte délégué au service de contenu (rendu identique à
                // l'ancien buildTelegramMessage, source unique désormais).
                $message = app(NotificationContentService::class)->telegramText('book_orders', [
                    'title' => $this->order->title,
                    'author' => $this->order->author ?? 'N/A',
                    'category' => $this->order->category?->name_fr ?? ($this->order->book?->defaultCategory?->name_fr ?? 'N/A'),
                    'url' => BookOrderedNotification::demandUrl($this->order->title),
                ]);
                app(TelegramNotificationService::class)->sendToChat($telegramChatId, $message);
            }
        }
    }
}
