<?php

namespace App\Jobs;

use App\Models\Order;
use App\Models\Profile;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
// use App\Notifications\BookOrderedNotification; // To create

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
        // On récupère tous les profils Pro et Premium
        $sellers = Profile::with(['user', 'user.notificationPreferences'])
            ->whereIn('subscription_type', ['pro', 'premium'])
            ->get();

        $delayHours = (int) env('PRO_NOTIFICATION_DELAY_HOURS', 3);

        foreach ($sellers as $profile) {
            $user = $profile->user;
            if (!$user) continue;

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
                
                if (is_array($filters) && isset($filters['categories'])) {
                    if (!in_array($categoryId, $filters['categories'])) {
                        continue; // Ce vendeur ne veut pas être notifié pour cette catégorie
                    }
                }
            }

            // TODO: Créer la classe BookOrderedNotification
            // $notification = new BookOrderedNotification($this->order, [
            //     'email' => $wantsEmail,
            //     'in_app' => $wantsInApp,
            //     'telegram' => $wantsTelegram
            // ]);

            // if ($profile->subscription_type === 'pro') {
            //     // Différé de X heures
            //     $user->notify($notification->delay(now()->addHours($delayHours)));
            // } else {
            //     // Premium = Immédiat
            //     $user->notify($notification);
            // }
            
            // Pour l'instant, on se contente de logguer l'intention pour prouver que l'architecture fonctionne
            Log::info("Notification de demande (Livre: {$this->order->title}) préparée pour l'utilisateur {$user->id} ({$profile->subscription_type})");
        }
    }
}
