<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    use HasFactory;

    protected $fillable = [
        'parent_id',
        'code',
        'name_fr',
        'name_ar',
        'slug',
        'audiences',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'audiences' => 'array',
        'is_active' => 'boolean',
    ];

    public function parent()
    {
        return $this->belongsTo(Category::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(Category::class, 'parent_id');
    }

    public function childrenRecursive()
    {
        return $this->children()->with('childrenRecursive');
    }

    public function listings()
    {
        return $this->hasMany(Listing::class);
    }

    public function booksAsDefault()
    {
        return $this->hasMany(Book::class, 'default_category_id');
    }

    public function levels()
    {
        return $this->belongsToMany(Level::class, 'category_level')
            ->withTimestamps();
    }

    public function subjects()
    {
        return $this->belongsToMany(Subject::class, 'category_subject')
            ->withTimestamps();
    }

    /**
     * Retourne l'ID de la catégorie actuelle
     * ainsi que les IDs de tous ses descendants.
     */
    public function selfAndDescendantIds(): array
    {
        $ids = [$this->id];

        foreach ($this->childrenRecursive as $child) {
            $ids = array_merge(
                $ids,
                $child->selfAndDescendantIds()
            );
        }

        return array_values(array_unique($ids));
    }
}
