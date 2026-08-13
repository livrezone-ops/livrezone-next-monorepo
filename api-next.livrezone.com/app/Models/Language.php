<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Language extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'name_fr',
        'name_ar',
        'is_active',
    ];

    public function listings()
    {
        return $this->hasMany(Listing::class);
    }
}
