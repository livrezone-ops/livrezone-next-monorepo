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
];
