<?php

namespace App\Models;

use App\Traits\HasCoverUrls;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Laravel\Scout\Searchable;

class Book extends Model
{
    use HasCoverUrls, HasFactory, Searchable;

    /**
     * Get the indexable data array for the model.
     *
     * @return array
     */
    public function toSearchableArray()
    {
        return [
            'id' => (int) $this->id,
            'title' => $this->title,
            'authors' => is_array($this->authors) ? implode(', ', $this->authors) : $this->authors,
            'isbn_13' => $this->isbn_13,
            'publisher' => $this->publisher,
            'cover_url' => $this->cover_url, // Inclus pour affichage direct depuis Meilisearch
            // Champs de filtre (doivent être déclarés filterable côté Meilisearch)
            'default_category_id' => $this->default_category_id,
            'language_id' => $this->language_id,
            'default_level_id' => $this->default_level_id,
            'created_at' => $this->created_at?->timestamp,
        ];
    }

    protected $appends = [
        'cover_url',
        'cover_thumbnail_url',
    ];

    protected $fillable = [
        'isbn_13',
        'title',
        'normalized_title',
        'authors',
        'publisher',
        'description',
        'publication_date',
        'language_id',
        'page_count',
        'indicative_price',
        'indicative_price_currency',
        'cover_path',
        'cover_source_url',
        'metadata_source',
        'metadata_sources',
        'default_category_id',
        'default_level_id',
        'default_subject_id',
        'breadcrumb',
        'last_verified_at',
    ];

    protected $casts = [
        'authors' => 'array',
        'metadata_sources' => 'array',
        'publication_date' => 'date',
        'last_verified_at' => 'datetime',
        'indicative_price' => 'decimal:2',
    ];

    public function language()
    {
        return $this->belongsTo(Language::class);
    }

    public function defaultCategory()
    {
        return $this->belongsTo(Category::class, 'default_category_id');
    }

    public function defaultLevel()
    {
        return $this->belongsTo(Level::class, 'default_level_id');
    }

    public function defaultSubject()
    {
        return $this->belongsTo(Subject::class, 'default_subject_id');
    }

    public function listings()
    {
        return $this->hasMany(Listing::class);
    }
}
