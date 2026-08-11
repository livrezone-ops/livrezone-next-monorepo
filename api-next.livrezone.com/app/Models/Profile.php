<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Profile extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'phone',
        'city_id',
        'profile_type',
        'subscription_type',
        'delivery_option',
        'nickname',
        'adresse',
        'logo',
        'rating_average',
        'rating_count',
    ];

    protected static function boot()
    {
        parent::boot();

        static::saving(function ($profile) {
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

            // Ensure uniqueness
            $originalNickname = $profile->nickname;
            $count = 2;
            
            while (static::where('nickname', $profile->nickname)->where('id', '!=', $profile->id)->exists()) {
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
