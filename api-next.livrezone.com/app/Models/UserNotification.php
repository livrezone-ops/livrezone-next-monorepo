<?php

namespace App\Models;

use Illuminate\Notifications\DatabaseNotification;

/**
 * Notification in-app étendue : colonnes `pinned_at` / `dismissed_at`
 * (migration 2026_08_31_000001) pour l'épinglage et le masquage
 * depuis la page des notifications.
 */
class UserNotification extends DatabaseNotification
{
    protected $table = 'notifications';

    protected $casts = [
        'data' => 'array',
        'read_at' => 'datetime',
        'pinned_at' => 'datetime',
        'dismissed_at' => 'datetime',
    ];

    /**
     * Notifications visibles dans la boîte de réception : les masquées
     * (dismissed_at) en sont exclues, y compris des compteurs non-lues.
     */
    public function scopeVisible($query)
    {
        $query->whereNull('dismissed_at');
    }
}
