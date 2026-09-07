<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Palier de récompense publié par l'admin (« offre » de parrainage).
 * Chaque palier choisit librement sa condition (inscriptions validées ou
 * visites uniques) et son contenu — payload typé par reward_type :
 *
 * - pro_days         : {days: int}
 * - percent_discount : {percent: int, scope: 'monthly'|'yearly'}
 * - coupon           : {amount: float} (MAD)
 * - ebook/premium_ebook : {title: string, file_path: string} (disque local privé)
 * - physical_book / gift : {title: string}
 */
class ReferralReward extends Model
{
    public const CONDITION_TYPES = ['signups', 'visits'];

    public const REWARD_TYPES = [
        'pro_days', 'percent_discount', 'coupon',
        'ebook', 'premium_ebook', 'physical_book', 'gift',
    ];

    protected $fillable = [
        'name',
        'description',
        'condition_type',
        'reward_type',
        'reward_payload',
        'threshold_value',
        'repeatable',
        'max_grants_per_user',
        'unit_cost',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'reward_payload' => 'array',
        'repeatable' => 'boolean',
        'is_active' => 'boolean',
        'unit_cost' => 'decimal:2',
        'max_grants_per_user' => 'integer',
        'threshold_value' => 'integer',
        'sort_order' => 'integer',
    ];

    public function grants(): HasMany
    {
        return $this->hasMany(ReferralRewardGrant::class, 'reward_id');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true)->orderBy('sort_order')->orderBy('threshold_value');
    }

    /**
     * Libellé humain de la récompense, affiché au parrain et à l'admin.
     */
    public function rewardLabel(): string
    {
        $payload = $this->reward_payload ?? [];

        return match ($this->reward_type) {
            'pro_days' => ($payload['days'] ?? 0).' jours de compte Pro',
            'percent_discount' => '-'.($payload['percent'] ?? 0).'% sur l\'abonnement '
                .(($payload['scope'] ?? 'monthly') === 'yearly' ? 'annuel' : 'mensuel'),
            'coupon' => 'Coupon de '.($payload['amount'] ?? 0).' MAD',
            'ebook' => 'Livre numérique'.(isset($payload['title']) ? ' : '.$payload['title'] : ''),
            'premium_ebook' => 'Ebook premium'.(isset($payload['title']) ? ' : '.$payload['title'] : ''),
            'physical_book' => 'Livre physique'.(isset($payload['title']) ? ' : '.$payload['title'] : ''),
            'gift' => $payload['title'] ?? 'Cadeau promotionnel',
            default => $this->name,
        };
    }

    /**
     * Libellé de la condition, ex. « 5 inscriptions validées » / « 200 visites ».
     */
    public function conditionLabel(): string
    {
        return $this->condition_type === 'visits'
            ? $this->threshold_value.' visites uniques'
            : $this->threshold_value.' inscription'.($this->threshold_value > 1 ? 's' : '').' validée'.($this->threshold_value > 1 ? 's' : '');
    }
}
