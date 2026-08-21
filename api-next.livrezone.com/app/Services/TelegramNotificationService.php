<?php

namespace App\Services;

use App\Models\Listing;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TelegramNotificationService
{
    public function sendNewListingNotification(Listing $listing)
    {
        if (!config('services.telegram.enabled', false)) {
            return;
        }

        $botToken = config('services.telegram.bot_token');
        $chatId = config('services.telegram.chat_id');

        if (!$botToken || !$chatId) {
            Log::warning('Telegram Notification: Missing configuration.');
            return;
        }

        $listing->load('user');
        $sellerName = $listing->user->name ?? 'Inconnu';
        $sellerPhone = $listing->user->phone ?? 'Inconnu';
        $statusText = $listing->status === 'published' ? '✅ Auto-validé (published)' : '⏳ En attente (pending_admin)';
        $url = "https://next.livrezone.com/books/{$listing->id}";

        $message = "📚 *Nouvelle Annonce sur LivreZone !*\n"
            . "━━━━━━━━━━━━━━━━━━\n"
            . "📖 Titre : {$listing->title}\n"
            . "💰 Prix : {$listing->price} MAD (État : {$listing->book_condition})\n"
            . "👤 Vendeur : {$sellerName} ({$sellerPhone})\n"
            . "🔢 ISBN : {$listing->isbn_13}\n"
            . "⚡ Statut : {$statusText}\n"
            . "🔗 Lien : {$url}";

        try {
            $apiUrl = "https://api.telegram.org/bot{$botToken}/sendMessage";
            
            $response = Http::post($apiUrl, [
                'chat_id' => $chatId,
                'text' => $message,
            ]);

            if ($response->failed()) {
                Log::error('Telegram Notification failed: ' . $response->body());
            }
        } catch (\Exception $e) {
            Log::error('Telegram Notification Exception: ' . $e->getMessage());
        }
    }
}
