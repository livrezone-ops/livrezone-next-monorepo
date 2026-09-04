<?php

return [
    'cache_ttl' => [
        /*
        |--------------------------------------------------------------------------
        | Cache TTL (Time To Live) en secondes
        |--------------------------------------------------------------------------
        |
        | Ces valeurs définissent la durée de conservation en cache Redis
        | pour différentes parties de l'application.
        |
        */

        // Données de référence (Catégories, Villes, Langues, Niveaux) - Défaut: 24h
        'reference_data' => (int) env('CACHE_TTL_REFERENCE_DATA', 86400),

        // Messages du Hero - Défaut: 24h
        'hero_messages' => (int) env('CACHE_TTL_HERO_MESSAGES', 86400),

        // Dernières annonces en page d'accueil - Défaut: 10 minutes
        'homepage_listings' => (int) env('CACHE_TTL_HOMEPAGE_LISTINGS', 600),
    ],

    'anti_scraping' => [
        'enabled' => env('ANTI_SCRAPING_ENABLED', false), // Désactivé par défaut comme demandé
        'max_requests_per_minute' => (int) env('ANTI_SCRAPING_MAX_REQUESTS', 10),
    ],

    'book_covers_url' => env('BOOK_COVERS_URL', null),

    // Image affichée si aucune couverture n'est trouvée (fallback final du trait HasCoverUrls)
    'cover_placeholder_url' => env('COVER_PLACEHOLDER_URL', null),

    /*
    |--------------------------------------------------------------------------
    | Simulateur de paiement (tests)
    |--------------------------------------------------------------------------
    |
    | PAYMENT_SIMULATOR=true : le bouton "Payer" confirme immédiatement la
    | transaction au lieu de rediriger vers une passerelle (CMI, etc.).
    | Ne JAMAIS activer en production.
    |
    */
    'payment_simulator' => env('PAYMENT_SIMULATOR', false),

    /*
    |--------------------------------------------------------------------------
    | Passerelles de paiement en ligne
    |--------------------------------------------------------------------------
    |
    | Activer une passerelle la propose aux utilisateurs lors du paiement.
    | Les webhooks correspondants doivent être configurés chez le prestataire
    | (voir PaymentGatewayService::verifyWebhookSignature).
    |
    */
    'payment_gateways' => [
        'cmi' => (bool) env('CMI_ENABLED', false),
        'fatourati' => (bool) env('FATOURATI_ENABLED', false),
    ],

    'payment_webhooks' => [
        'cmi' => env('CMI_WEBHOOK_SECRET'),
        'fatourati' => env('FATOURATI_WEBHOOK_SECRET'),
    ],

    /*
    |----------------------------------------------------------------------
    | Couvertures de livres modérées (masquées)
    |----------------------------------------------------------------------
    |
    | ISBN-13 dont la couverture ne doit PAS être affichée (contenu inadapté,
    | image erronée…). Le trait HasCoverUrls renvoie alors le placeholder
    | « pas de couverture » à la place, partout (catalogue, fiche, panier…).
    | Compléter cette liste via la variable BLOCKED_COVER_ISBNS du .env
    | (ISBN séparés par des virgules) — effet immédiat, sans réindexation.
    |
    */
    'blocked_cover_isbns' => array_values(array_filter(array_map('trim', explode(',', (string) env('BLOCKED_COVER_ISBNS', '9782382760888'))))),
];
