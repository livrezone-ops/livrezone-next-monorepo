<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Attribution d'un filleul à un parrain, figée à l'inscription.
 * pending = compte créé, email non encore vérifié ;
 * valid = email vérifié (seul état qui compte pour les récompenses) ;
 * invalid = fraude détectée (raison dans invalid_reason).
 */
class ReferralSignup extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_VALID = 'valid';

    public const STATUS_INVALID = 'invalid';

    protected $fillable = [
        'referrer_user_id',
        'filleul_user_id',
        'status',
        'invalid_reason',
        'ip_hash',
        'fingerprint_hash',
        'valid_at',
    ];

    protected $casts = [
        'valid_at' => 'datetime',
    ];

    public function referrer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'referrer_user_id');
    }

    public function filleul(): BelongsTo
    {
        return $this->belongsTo(User::class, 'filleul_user_id');
    }
}
