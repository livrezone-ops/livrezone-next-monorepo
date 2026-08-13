<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Book extends Model
{
    use HasFactory;

    protected $appends = [
        'cover_url',
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

    public function getCoverUrlAttribute(): ?string
    {
        $path = trim((string) ($this->cover_path ?? ''));

        if ($path !== '') {
            if (Str::startsWith($path, ['http://', 'https://'])) {
                return $path;
            }

            // Nettoyage au cas où le path contient 'originals/'
            $cleanPath = ltrim(str_replace('originals/', '', $path), '/');
            
            // On utilise la route du proxy ou BOOK_COVERS_URL
            $baseUrl = env('BOOK_COVERS_URL', url('/book-cover-proxy'));
            return rtrim($baseUrl, '/') . '/' . $cleanPath;
        }

        $external = trim((string) ($this->cover_source_url ?? ''));

        return $external !== '' ? $external : null;
    }

    public function getCoverThumbnailUrl(int $size = 160): ?string
    {
        $path = trim((string) ($this->cover_path ?? ''));

        if ($path !== '') {
            if (Str::startsWith($path, ['http://', 'https://'])) {
                return $path;
            }

            $cleanPath = ltrim(str_replace('originals/', '', $path), '/');
            $cleanPathWebp = preg_replace('/\.(jpg|jpeg|png)$/i', '.webp', $cleanPath);
            $baseUrl = env('BOOK_COVERS_URL', url('/book-cover-proxy'));
            return rtrim($baseUrl, '/') . "/thumbnails/{$size}/" . $cleanPathWebp;
        }

        $external = trim((string) ($this->cover_source_url ?? ''));

        return $external !== '' ? $external : null;
    }
}
