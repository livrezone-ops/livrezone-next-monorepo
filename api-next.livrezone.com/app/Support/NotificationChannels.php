<?php

namespace App\Support;

/**
 * Vocabulaire unique des canaux de notification.
 *
 * Deux nomenclatures coexistent légitimement dans l'application :
 * - les canaux LARAVEL (méthode via() des notifications,
 *   SubscriptionService::allowedNotificationChannels) : mail, database… ;
 * - les clés de PRÉFÉRENCES (table notification_preferences + contrat JSON
 *   de l'API /profile/notifications) : email, in_app… (compatibilité
 *   historique des données déjà persistées).
 *
 * Toute comparaison ou écriture de canal DOIT passer par ces constantes ou
 * par les mappings ci-dessous — jamais par une chaîne brute. Le digest de
 * chat (T3) croise les deux mondes : c'est là qu'une divergence casserait.
 */
final class NotificationChannels
{
    // Canaux Laravel (via() / allowedNotificationChannels)
    public const MAIL = 'mail';

    public const DATABASE = 'database';

    public const TELEGRAM = 'telegram';

    public const WHATSAPP = 'whatsapp';

    // Clés de préférences (table notification_preferences + API)
    public const PREF_EMAIL = 'email';

    public const PREF_IN_APP = 'in_app';

    public const PREF_TELEGRAM = 'telegram';

    public const PREF_WHATSAPP = 'whatsapp';

    /** Clé de préférence => canal Laravel. */
    public const PREFERENCE_TO_LARAVEL = [
        self::PREF_EMAIL => self::MAIL,
        self::PREF_IN_APP => self::DATABASE,
        self::PREF_TELEGRAM => self::TELEGRAM,
    ];

    /** Canal Laravel => clé de préférence. */
    public const LARAVEL_TO_PREFERENCE = [
        self::MAIL => self::PREF_EMAIL,
        self::DATABASE => self::PREF_IN_APP,
        self::TELEGRAM => self::PREF_TELEGRAM,
    ];

    /**
     * Traduit une clé de préférence en canal Laravel (null si inconnu).
     */
    public static function toLaravel(string $preferenceChannel): ?string
    {
        return self::PREFERENCE_TO_LARAVEL[$preferenceChannel] ?? null;
    }

    /**
     * Traduit un canal Laravel en clé de préférence (null si inconnu).
     */
    public static function toPreference(string $laravelChannel): ?string
    {
        return self::LARAVEL_TO_PREFERENCE[$laravelChannel] ?? null;
    }
}
