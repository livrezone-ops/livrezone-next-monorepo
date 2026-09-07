<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Récompense accordée à un parrain (ledger). L'attribution et la livraison
 * sont deux états distincts : pro_days/coupon sont « granted » et créditées
 * immédiatement ; livre physique/cadeau restent « granted » jusqu'à
 * l'expédition (adresse collectée via le claim, livraison marquée par l'admin).
 */
class ReferralRewardGrant extends Model
{
    public const STATUS_GRANTED = 'granted';

    public const STATUS_DELIVERED = 'delivered';

    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'reward_id',
        'user_id',
        'signup_id',
        'status',
        'delivery',
        'granted_at',
        'delivered_at',
    ];

    protected $casts = [
        'delivery' => 'array',
        'granted_at' => 'datetime',
        'delivered_at' => 'datetime',
    ];

    public function reward(): BelongsTo
    {
        return $this->belongsTo(ReferralReward::class, 'reward_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function signup(): BelongsTo
    {
        return $this->belongsTo(ReferralSignup::class, 'signup_id');
    }
}
