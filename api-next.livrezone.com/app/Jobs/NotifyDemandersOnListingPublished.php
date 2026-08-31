<?php

namespace App\Jobs;

use App\Models\Listing;
use App\Models\Order;
use App\Services\WhatsAppNotificationService;
use App\Support\NotificationChannels;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Notifie les demandeurs (WhatsApp) quand une annonce publiée correspond
 * à leur demande de livre (match par ISBN ou titre normalisé).
 * Canal activé par défaut (préférence absente = activé) ; désactivation
 * explicite possible dans le dashboard. Garde-fous : profiles.has_whatsapp
 * + numéro de mobile, auto-exclusion vendeur lui-même.
 */
class NotifyDemandersOnListingPublished implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(protected Listing $listing)
    {
        //
    }

    public function handle(WhatsAppNotificationService $whatsapp): void
    {
        if (! config('services.whatsapp.enabled', false)) {
            return;
        }

        $normalizedTitle = mb_strtolower(trim($this->listing->title));

        $orders = Order::query()
            ->where('status', 'published')
            ->where('user_id', '!=', $this->listing->user_id)
            ->where(function ($q) use ($normalizedTitle) {
                if (! empty($this->listing->isbn_13)) {
                    $q->orWhere('isbn', $this->listing->isbn_13);
                }
                $q->orWhereRaw('LOWER(TRIM(title)) = ?', [$normalizedTitle]);
            })
            ->with(['user.profile', 'user.notificationPreferences'])
            ->limit(100)
            ->get();

        foreach ($orders as $order) {
            $user = $order->user;
            $profile = $user?->profile;

            if (! $user || ! $profile || empty($profile->phone) || ! $profile->has_whatsapp) {
                continue;
            }

            // Canal activé par défaut (préférence absente = activé) ;
            // la désactivation explicite (is_enabled = false) est respectée.
            $wantsWhatsApp = $user->notificationPreferences
                ->where('notification_type', 'book_orders')
                ->where('channel', NotificationChannels::PREF_WHATSAPP)
                ->first()?->is_enabled ?? true;

            if (! $wantsWhatsApp) {
                continue;
            }

            $whatsapp->sendText($profile->phone, $this->buildMessage($order));
        }
    }

    protected function buildMessage(Order $order): string
    {
        $listing = $this->listing;
        $price = $listing->discount_price ?? $listing->price;
        $url = $listing->book_id
            ? 'https://next.livrezone.com/books/'.$listing->book_id
            : 'https://next.livrezone.com/annonces?isbn='.urlencode((string) $listing->isbn_13);

        return "*Bonne nouvelle ! Le livre que vous cherchez est disponible*\n"
            ."━━━━━━━━━━━━━━━━━━\n"
            ."📖 {$listing->title}\n"
            .'✍️ Auteur : '.($listing->author ?: $order->author ?: 'N/A')."\n"
            ."💰 Prix : {$price} MAD (État : {$listing->book_condition})\n"
            ."🔗 Voir l'annonce : {$url}";
    }
}
