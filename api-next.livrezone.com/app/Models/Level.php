<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Level extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'name_fr',
        'cycle',
        'rank',
        'is_active',
    ];

    public function categories()
    {
        return $this->belongsToMany(Category::class, 'category_level')
            ->withTimestamps();
    }

    public function subjects()
    {
        return $this->belongsToMany(Subject::class, 'subject_level')
            ->withTimestamps();
    }

    public function listings()
    {
        return $this->hasMany(Listing::class);
    }
}
