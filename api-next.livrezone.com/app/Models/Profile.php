<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Profile extends Model
{
    use HasFactory;

    /**
     * Nicknames réservés : mots clés des routes statiques du frontend et zones sensibles.
     * Source unique de vérité (validation + hook de sauvegarde).
     */
    public const RESERVED_NICKNAMES = [
        'login',
        'register',
        'dashboard',
        'profile',
        'admin',
        'api',
        'logout',
        'password',
        'annonces',
        'livres',
        'catalogue',
        'faq',
        'livraison',
        'retours',
        'vendre',
        'cgv',
        'confidentialite',
        'mentions-legales',
        'favorites',
        'cart',
        'chat',
        'contact',
        'aide',
        'tweets',
    ];

    protected $fillable = [
        'user_id',
        'phone',
        'has_whatsapp',
        'city_id',
        'profile_type',
        'subscription_type',
        'delivery_option',
        'nickname',
        'adresse',
        'logo',
        'avatar_mode',
        'avatar_upload',
        'rating_average',
        'rating_count',
    ];

    protected $casts = [
        'has_whatsapp' => 'boolean',
    ];

    protected static function boot()
    {
        parent::boot();

        static::saving(function ($profile) {
            // Détection automatique WhatsApp selon le type de numéro marocain (fixe vs portable)
            if (!empty($profile->phone)) {
                $clean = preg_replace('/[^\d]/', '', $profile->phone);
                // Si fixe marocain (commence par 05, 2125, ou 5 avec 9 chiffres)
                if (preg_match('/^(?:05|2125|5\d{8})/', $clean)) {
                    $profile->has_whatsapp = false;
                } elseif (!isset($profile->has_whatsapp)) {
                    // Si portable (06, 07, 2126, 2127) et non défini explicitement
                    $profile->has_whatsapp = true;
                }
            }

            if (empty($profile->nickname)) {
                $user = $profile->user;
                $baseNickname = $user ? \Illuminate\Support\Str::slug($user->name) : 'utilisateur-' . ($profile->user_id ?? rand(1000, 9999));
                if (empty(trim($baseNickname, '-'))) {
                    $baseNickname = 'utilisateur-' . ($profile->user_id ?? rand(1000, 9999));
                }
                $profile->nickname = $baseNickname;
            } else {
                $profile->nickname = \Illuminate\Support\Str::slug($profile->nickname);
            }

            // Ensure uniqueness + éviter les nicknames réservés
            $reserved = self::RESERVED_NICKNAMES;
            $originalNickname = $profile->nickname;
            $count = 2;

            while (
                in_array($profile->nickname, $reserved, true) ||
                static::where('nickname', $profile->nickname)->where('id', '!=', $profile->id)->exists()
            ) {
                $profile->nickname = $originalNickname . '-' . $count++;
            }
        });
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function city()
    {
        return $this->belongsTo(City::class);
    }

    public function ratings()
    {
        return $this->hasMany(Rating::class);
    }

    public function updateRatingStats()
    {
        $this->update([
            'rating_average' => $this->ratings()->avg('score') ?? 0,
            'rating_count' => $this->ratings()->count(),
        ]);
    }
}
