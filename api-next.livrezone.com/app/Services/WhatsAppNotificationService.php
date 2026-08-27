<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppNotificationService
{
    /**
     * Envoie un message texte WhatsApp via la passerelle Evolution API.
     * Usage strictement transactionnel (protection du numéro contre le ban Meta).
     */
    public function sendText(string $phone, string $message): bool
    {
        if (! config('services.whatsapp.enabled', false)) {
            return false;
        }

        $number = $this->normalizePhone($phone);
        if (! $number) {
            Log::warning('WhatsApp Notification: numéro invalide ou manquant.');

            return false;
        }

        $apiUrl = rtrim((string) config('services.whatsapp.api_url'), '/');
        $apiKey = config('services.whatsapp.api_key');
        $instance = config('services.whatsapp.instance', 'livrezone');

        if (! $apiUrl || ! $apiKey || ! $instance) {
            Log::warning('WhatsApp Notification: configuration manquante (url / apikey / instance).');

            return false;
        }

        try {
            $response = Http::withHeaders(['apikey' => $apiKey])
                ->timeout(10)
                ->post("{$apiUrl}/message/sendText/{$instance}", [
                    'number' => $number,
                    'text' => $message,
                ]);

            if ($response->failed()) {
                Log::error('WhatsApp Notification failed: '.$response->body());

                return false;
            }

            return true;
        } catch (\Exception $e) {
            Log::error('WhatsApp Notification Exception: '.$e->getMessage());

            return false;
        }
    }

    /**
     * Normalise un numéro marocain vers le format international attendu par
     * Evolution API (ex : "0675245752" => "212675245752", gère "+212…"/"212…").
     */
    public function normalizePhone(?string $phone): ?string
    {
        $digits = preg_replace('/[^0-9]/', '', (string) $phone);

        if ($digits === '' || $digits === null) {
            return null;
        }

        if (str_starts_with($digits, '212')) {
            return $digits;
        }

        if (str_starts_with($digits, '0')) {
            return '212'.substr($digits, 1);
        }

        // Numéro opérateur sans 0 ni indicatif (ex : 6XXXXXXXX)
        return '212'.$digits;
    }
}
