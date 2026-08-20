<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name','email','password','provider','provider_id','avatar','profile_completed','is_admin','is_active','last_login_at'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'profile_completed' => 'boolean',
            'is_admin' => 'boolean',
            'is_active' => 'boolean',
            'last_login_at' => 'datetime',
        ];
    }

    public function profile()
    {
        return $this->hasOne(Profile::class);
    }

    // Un utilisateur est considéré « en ligne » si sa dernière connexion
    // remonte à moins de ONLINE_WINDOW_SECONDS (5 minutes par défaut).
    public function isOnline(int $windowSeconds = 300): bool
    {
        return $this->last_login_at !== null
            && $this->last_login_at->gte(now()->subSeconds($windowSeconds));
    }

    public function listings()
    {
        return $this->hasMany(Listing::class);
    }

    public function reviewedListings()
    {
        return $this->hasMany(Listing::class, 'reviewed_by');
    }

    public function givenRatings()
    {
        return $this->hasMany(Rating::class);
    }

    public function favorites()
    {
        return $this->hasMany(Favorite::class);
    }

    public function cartItems()
    {
        return $this->hasMany(CartItem::class);
    }

    public function chatThreadsAsUserOne()
    {
        return $this->hasMany(ChatThread::class, 'user_one_id');
    }

    public function chatThreadsAsUserTwo()
    {
        return $this->hasMany(ChatThread::class, 'user_two_id');
    }

    /**
     * Retourne tous les fils de discussion de l'utilisateur.
     */
    public function chatThreads()
    {
        return ChatThread::where('user_one_id', $this->id)
            ->orWhere('user_two_id', $this->id);
    }

    /**
     * Sécurité globale : Remplacer le nom par le nickname partout sur le site.
     */
    public function getNameAttribute($value)
    {
        return $this->profile?->nickname ?? $value;
    }
}
