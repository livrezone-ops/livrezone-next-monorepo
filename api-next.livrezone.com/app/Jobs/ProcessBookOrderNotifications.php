<?php

namespace App\Jobs;

use App\Models\Order;
use App\Models\Profile;
use App\Notifications\BookOrderedNotification;
use App\Services\SubscriptionService;
use App\Services\TelegramNotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

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
            if (!$user) {
                continue;
            }

            // Free (hors promo) : aucune notification
            if (!$subscriptionService->canReceiveNotifications($profile)) {
                continue;
            }

            // Vérifier les préférences (si non défini, on suppose true par défaut pour email et in_app)
            $prefs = $user->notificationPreferences->where('notification_type', 'book_orders');

            $wantsEmail = $prefs->where('channel', 'email')->first()?->is_enabled ?? true;
            $wantsInApp = $prefs->where('channel', 'in_app')->first()?->is_enabled ?? true;
            $wantsTelegram = $prefs->where('channel', 'telegram')->first()?->is_enabled ?? false;

            if (!$wantsEmail && !$wantsInApp && !$wantsTelegram) {
                continue; // L'utilisateur a tout désactivé
            }

            // Vérifier le filtre de catégorie si présent
            $book = $this->order->book;
            $categoryId = $book?->default_category_id ?? $this->order->category_id;
            if ($categoryId) {
                // On prend les filtres du premier canal activé (supposant que les filtres sont partagés)
                $firstActivePref = $prefs->where('is_enabled', true)->first();
                $filters = $firstActivePref ? $firstActivePref->filters : null;

                if (is_array($filters) && isset($filters['categories']) && count($filters['categories']) > 0) {
                    if (!in_array($categoryId, $filters['categories'])) {
                        continue; // Ce vendeur ne veut pas être notifié pour cette catégorie
                    }
                }
            }

            // Canaux autorisés selon l'abonnement (centralisé dans SubscriptionService)
            $allowedChannels = $subscriptionService->allowedNotificationChannels($profile);
            $laravelChannels = [];
            $telegramChatId = null;

            if (in_array('database', $allowedChannels) && $wantsInApp) {
                $laravelChannels[] = 'database';
            }
            if (in_array('mail', $allowedChannels) && $wantsEmail) {
                $laravelChannels[] = 'mail';
            }
            if (in_array('telegram', $allowedChannels) && $wantsTelegram && $profile->telegram_id) {
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
                $message = $this->buildTelegramMessage();
                app(TelegramNotificationService::class)->sendToChat($telegramChatId, $message);
            }
        }
    }

    /**
     * Construit le message Telegram pour une nouvelle demande de livre.
     */
    protected function buildTelegramMessage(): string
    {
        $order = $this->order;
        $url = "https://next.livrezone.com/annonces";
        $category = $order->category?->name_fr ?? ($order->book?->defaultCategory?->name_fr ?? 'N/A');

        return "📚 *Nouvelle demande de livre sur LivreZone !*\n"
            . "━━━━━━━━━━━━━━━━━━\n"
            . "📖 Titre : {$order->title}\n"
            . "✍️ Auteur : " . ($order->author ?? 'N/A') . "\n"
            . "🏷️ Catégorie : {$category}\n"
            . "🔗 Lien : {$url}";
    }
}
