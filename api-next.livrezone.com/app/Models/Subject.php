<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Subject extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'name_fr',
        'name_ar',
        'family',
        'is_active',
    ];

    public function levels()
    {
        return $this->belongsToMany(Level::class, 'subject_level')
            ->withTimestamps();
    }

    public function categories()
    {
        return $this->belongsToMany(Category::class, 'category_subject')
            ->withTimestamps();
    }

    public function listings()
    {
        return $this->hasMany(Listing::class);
    }
}
