<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Profile;
use App\Services\TelegramNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class TelegramWebhookController extends Controller
{
    /**
     * Réception des mises à jour Telegram (webhook public, sans auth).
     * Gère la liaison d'un compte via la commande « /start <token> ».
     */
    public function handle(Request $request, TelegramNotificationService $telegram): JsonResponse
    {
        $secret = (string) config('services.telegram.webhook_secret');
        $header = (string) $request->header('X-Telegram-Bot-Api-Secret-Token');

        if ($secret === '' || ! hash_equals($secret, $header)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $update = $request->json()->all();

        $message = $update['message'] ?? $update['edited_message'] ?? null;
        if (! $message) {
            return response()->json(['ok' => true]);
        }

        $chatId = $message['chat']['id'] ?? null;
        $text = trim((string) ($message['text'] ?? ''));

        if (! $chatId) {
            return response()->json(['ok' => true]);
        }

        // Liaison d'un compte via « /start <token> » (deep link t.me/<bot>?start=<token>).
        if (preg_match('#^/start\s+(\S+)$#', $text, $m)) {
            $token = $m[1];

            $profile = Profile::query()
                ->where('telegram_link_token', $token)
                ->where('telegram_link_token_expires_at', '>', now())
                ->first();

            if ($profile) {
                $profile->update([
                    'telegram_id' => (string) $chatId,
                    'telegram_link_token' => null,
                    'telegram_link_token_expires_at' => null,
                    'telegram_linked_at' => now(),
                ]);

                $telegram->sendToChat((string) $chatId, '✅ Compte LivreZone lié avec succès ! Vous recevrez vos notifications ici.');
            } else {
                Log::info('Telegram webhook: token de liaison invalide ou expiré.');
                $telegram->sendToChat((string) $chatId, '⚠️ Lien invalide ou expiré. Générez un nouveau lien depuis votre espace LivreZone.');
            }

            return response()->json(['ok' => true]);
        }

        // Accueil simple pour « /start » sans token.
        if ($text === '/start') {
            $telegram->sendToChat(
                (string) $chatId,
                '👋 Bonjour ! Pour lier votre compte LivreZone, utilisez le lien présent dans vos paramètres de notifications.'
            );
        }

        return response()->json(['ok' => true]);
    }
}
