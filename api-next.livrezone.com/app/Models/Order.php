<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use Laravel\Scout\Searchable;

class Order extends Model
{
    use HasFactory, Searchable;

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
        ];
    }

    public const USER_COVER_DIR = 'book-covers/user-uploads';

    public static function isUserUploadedCover(?string $coverPath): bool
    {
        if ($coverPath === null) return false;
        return str_starts_with($coverPath, self::USER_COVER_DIR . '/');
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

    public function getCoverUrlAttribute(): ?string
    {
        $path = trim((string) ($this->cover_path ?? ''));

        if ($path !== '') {
            if (Str::startsWith($path, ['http://', 'https://'])) {
                return $path;
            }

            if (self::isUserUploadedCover($path)) {
                return asset('storage/' . $path);
            }

            // Couverture catalogue : nom de fichier simple (ex: 9782723486705.webp)
            $cleanPath = ltrim(str_replace('originals/', '', $path), '/');
            $baseUrl = config('livrezone.book_covers_url', url('/book-cover-proxy'));
            return rtrim($baseUrl, '/') . '/' . $cleanPath;
        }

        return $this->book?->cover_url ?? null;
    }

    public function getCoverThumbnailUrlAttribute(): ?string
    {
        return $this->getCoverThumbnailUrl(160);
    }

    public function getCoverThumbnailUrl(int $size = 160): ?string
    {
        $path = trim((string) ($this->cover_path ?? ''));

        if ($path !== '') {
            if (Str::startsWith($path, ['http://', 'https://'])) {
                return $path;
            }

            if (self::isUserUploadedCover($path)) {
                return asset('storage/' . $path);
            }

            // Miniature catalogue 160px
            $cleanPath = ltrim(str_replace('originals/', '', $path), '/');
            $cleanPathWebp = preg_replace('/\.(jpg|jpeg|png)$/i', '.webp', $cleanPath);
            $baseUrl = config('livrezone.book_covers_url', url('/book-cover-proxy'));
            return rtrim($baseUrl, '/') . "/thumbnails/{$size}/" . $cleanPathWebp;
        }

        return $this->book?->cover_thumbnail_url ?? null;
    }

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
