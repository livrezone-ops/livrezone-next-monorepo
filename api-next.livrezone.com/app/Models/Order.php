<?php

namespace App\Models;

use App\Traits\HasCoverUrls;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Laravel\Scout\Searchable;

class Order extends Model
{
    use HasCoverUrls, HasFactory, Searchable;

    public function searchableAs(): string
    {
        return 'orders';
    }

    /**
     * Seules les demandes publiées sont indexées dans l'annuaire public.
     */
    public function shouldBeSearchable(): bool
    {
        return $this->status === 'published';
    }

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
            'author' => $this->author,
            'isbn' => $this->isbn,
            'comment' => $this->comment,
            'status' => $this->status,
            'category_id' => (int) $this->category_id,
            'city_id' => (int) ($this->user?->profile?->city_id),
            'language_id' => (int) ($this->book?->language_id),
            'published_at' => $this->published_at?->timestamp,
        ];
    }

    /**
     * Fallback couverture : délégation au livre associé.
     */
    protected function coverFallbackUrl(bool $thumbnail = false): ?string
    {
        return $thumbnail
            ? ($this->book?->cover_thumbnail_url ?? null)
            : ($this->book?->cover_url ?? null);
    }

    protected $fillable = [
        'user_id',
        'book_id',
        'title',
        'author',
        'isbn',
        'category_id',
        'cover_path',
        'comment',
        'status',
        'published_at',
    ];

    protected $casts = [
        'published_at' => 'datetime',
    ];

    protected $appends = [
        'cover_url',
        'cover_thumbnail_url',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function book()
    {
        return $this->belongsTo(Book::class);
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }
}
