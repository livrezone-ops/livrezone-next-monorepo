<?php

namespace App\Services;

use App\Models\Listing;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TelegramNotificationService
{
    /**
     * Notifie le chat administrateur (config `services.telegram.chat_id`) de la
     * création / mise à jour d'une annonce. Diffusé vers un chat unique (admin),
     * volontairement séparé du flux per-user (`sendToChat`) qui s'appuie sur le
     * `telegram_id` lié par utilisateur.
     */
    public function notifyAdminNewListing(Listing $listing): void
    {
        if (! config('services.telegram.enabled', false)) {
            return;
        }

        $botToken = config('services.telegram.bot_token');
        $chatId = config('services.telegram.chat_id');

        if (! $botToken || ! $chatId) {
            Log::warning('Telegram Notification: Missing configuration (admin listing).');

            return;
        }

        $listing->load('user');
        $sellerName = $listing->user->name ?? 'Inconnu';
        $sellerPhone = $listing->user->phone ?? 'Inconnu';
        $statusText = $listing->status === 'published' ? '✅ Auto-validé (published)' : '⏳ En attente (pending_admin)';
        $url = "https://next.livrezone.com/books/{$listing->id}";

        $message = "📚 *Nouvelle Annonce sur LivreZone !*\n"
            ."━━━━━━━━━━━━━━━━━━\n"
            ."📖 Titre : {$listing->title}\n"
            ."💰 Prix : {$listing->price} MAD (État : {$listing->book_condition})\n"
            ."👤 Vendeur : {$sellerName} ({$sellerPhone})\n"
            ."🔢 ISBN : {$listing->isbn_13}\n"
            ."⚡ Statut : {$statusText}\n"
            ."🔗 Lien : {$url}";

        try {
            $apiUrl = "https://api.telegram.org/bot{$botToken}/sendMessage";

            $response = Http::post($apiUrl, [
                'chat_id' => $chatId,
                'text' => $message,
            ]);

            if ($response->failed()) {
                Log::error('Telegram Notification failed: '.$response->body());
            }
        } catch (\Exception $e) {
            Log::error('Telegram Notification Exception: '.$e->getMessage());
        }
    }

    /**
     * Envoie un message texte à un chat Telegram spécifique (par utilisateur).
     * Utilisé par le flux per-user des demandes de livre (telegram_id lié via webhook).
     */
    public function sendToChat(string $chatId, string $message): void
    {
        if (! config('services.telegram.enabled', false)) {
            return;
        }

        $botToken = config('services.telegram.bot_token');

        if (! $botToken || ! $chatId) {
            Log::warning('Telegram Notification: Missing configuration (sendToChat).');

            return;
        }

        try {
            $apiUrl = "https://api.telegram.org/bot{$botToken}/sendMessage";

            $response = Http::post($apiUrl, [
                'chat_id' => $chatId,
                'text' => $message,
                'parse_mode' => 'Markdown',
            ]);

            if ($response->failed()) {
                Log::error('Telegram Notification failed: '.$response->body());
            }
        } catch (\Exception $e) {
            Log::error('Telegram Notification Exception: '.$e->getMessage());
        }
    }
}
