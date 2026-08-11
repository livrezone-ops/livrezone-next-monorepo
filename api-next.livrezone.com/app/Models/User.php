<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name','email','password','provider','provider_id','avatar','profile_completed','is_admin'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'profile_completed' => 'boolean',
            'is_admin' => 'boolean',
        ];
    }

    public function profile()
    {
        return $this->hasOne(Profile::class);
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

    /**
     * Sécurité globale : Remplacer le nom par le nickname partout sur le site.
     */
    public function getNameAttribute($value)
    {
        return $this->profile?->nickname ?? $value;
    }
}
