<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Visite entrante via un lien de parrainage. Ligne immuable (pas de
 * updated_at) : la vérité agrégée vit dans users.referral_shares_count,
 * cette table sert au dédoublonnage, à l'anti-fraude et aux séries du
 * dashboard. Purge 90 jours via referral:purge-visits.
 */
class ReferralVisit extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'referrer_user_id',
        'fingerprint_hash',
        'ip_hash',
        'user_agent',
        'referer',
        'landing_path',
        'country',
        'is_bot',
        'counted',
        'created_at',
    ];

    protected $casts = [
        'is_bot' => 'boolean',
        'counted' => 'boolean',
        'created_at' => 'datetime',
    ];

    public function referrer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'referrer_user_id');
    }
}
