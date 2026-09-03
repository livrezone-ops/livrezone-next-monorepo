<?php

// Durcissement CORS : FRONTEND_URL n'est admise comme origine autorisée que si
// c'est une URL valide — rejette '*', une chaîne vide ou toute valeur parasite
// qui, combinée à supports_credentials = true, ouvrirait l'API à toutes les
// origines. (Les autres valeurs restent des origines explicites fixes.)
$frontendOrigin = filter_var(env('FRONTEND_URL'), FILTER_VALIDATE_URL) ?: null;

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie', 'broadcasting/auth'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    'allowed_origins' => array_values(array_unique(array_filter([
        'http://localhost:3000',
        'https://next.livrezone.com',
        $frontendOrigin,
    ]))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['Accept', 'Authorization', 'Content-Type', 'Origin', 'X-Requested-With', 'X-CSRF-TOKEN', 'X-XSRF-TOKEN'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
