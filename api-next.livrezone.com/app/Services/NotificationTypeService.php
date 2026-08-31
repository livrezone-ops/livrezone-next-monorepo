<?php

namespace App\Services;

/**
 * Registre central des types de notifications in-app (canal database).
 *
 * Source unique de vérité pour :
 * - la validation du paramètre `type` du filtre de la boîte de réception
 *   (GET /api/notifications?type=...) ;
 * - la liste des filtres exposée au front via `meta.types`.
 *
 * Évolutivité : pour ajouter un nouveau type de notification, ajouter une
 * entrée ici (clé technique => libellé FR) + émettre les notifications avec
 * `data['type']` = clé. Le front affiche automatiquement le nouveau filtre
 * (meta.types), les types inconnus du front retombant sur « Autres ».
 */
class NotificationTypeService
{
    /**
     * Types filtrables de la boîte de réception, avec leur libellé FR.
     *
     * @var array<string, string>
     */
    public const FILTERABLE = [
        'book_orders' => 'Demandes',
        'messages' => 'Messages',
        'newsletter' => 'Newsletter',
        'promos' => 'Promotions',
        'site_updates' => 'Mises à jour du site',
        'features' => 'Nouvelles fonctionnalités',
    ];

    /**
     * Liste des clés de types filtrables.
     *
     * @return array<int, string>
     */
    public static function keys(): array
    {
        return array_keys(self::FILTERABLE);
    }

    /**
     * Map clé => libellé FR exposée au front.
     *
     * @return array<string, string>
     */
    public static function labels(): array
    {
        return self::FILTERABLE;
    }
}
