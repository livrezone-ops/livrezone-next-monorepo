<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Category;
use Illuminate\Database\Eloquent\Builder;

class Listing extends Model
{
    use HasFactory;

    // ----------------------------------------------------------------
    // Sécurité des couvertures

    /** Préfixe de dossier pour les couvertures uploadées par les utilisateurs */
    public const USER_COVER_DIR = 'book-covers/user-uploads';

    /**
     * Retourne true uniquement si le chemin appartient aux uploads utilisateurs.
     * Les couvertures catalogue (books) ne contiennent jamais de '/' dans leur nom.
     */
    public static function isUserUploadedCover(?string $coverPath): bool
    {
        return $coverPath !== null
            && str_starts_with($coverPath, self::USER_COVER_DIR . '/');
    }

    protected static function boot(): void
    {
        parent::boot();

        // Lors de la suppression d'un listing, supprimer physiquement
        // le fichier couverture UNIQUEMENT s'il s'agit d'un upload utilisateur.
        // Les couvertures catalogue/books ne sont jamais supprimées.
        static::deleting(function (Listing $listing) {
            if (static::isUserUploadedCover($listing->cover_path)) {
                $full = public_path($listing->cover_path);
                if (file_exists($full)) {
                    @unlink($full);
                }
            }
        });
    }

    protected $fillable = [
        'user_id',
        'listing_type',
        'book_id',
        'isbn_13',
        'title',
        'description',
        'book_condition',
        'price',
        'discount_price',
        'pack_price',
        'pack_discount_price',
        'currency',
        'quantity',
        'cover_path',
        'cover_source_url',
        'category_id',
        'level_id',
        'subject_id',
        'language_id',
        'status',
        'submitted_at',
        'reviewed_at',
        'reviewed_by',
        'moderation_note',
        'published_at',
        'deleted_at',
    ];

    protected $appends = [
        'cover_url',
        'cover_thumbnail_url',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'discount_price' => 'decimal:2',
        'pack_price' => 'decimal:2',
        'pack_discount_price' => 'decimal:2',
        'submitted_at' => 'datetime',
        'reviewed_at' => 'datetime',
        'published_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function book()
    {
        return $this->belongsTo(Book::class);
    }

public function category()
{
    return $this->belongsTo(Category::class);
}

/**
 * Filtre les listings d'une catégorie et de ses sous-catégories.
 */
public function scopeInCategory(
    Builder $query,
    string $category
): Builder {
    $selectedCategory = Category::query()
        ->with('childrenRecursive')
        ->where(function (Builder $categoryQuery) use ($category) {
            $categoryQuery
                ->where('code', $category)
                ->orWhere('slug', $category)
                ->orWhere('name_fr', $category);
        })
        ->where('is_active', true)
        ->first();

    if (!$selectedCategory) {
        return $query->whereRaw('1 = 0');
    }

    return $query->whereIn(
        'category_id',
        $selectedCategory->selfAndDescendantIds()
    );
}

/**
 * Retourne aléatoirement des listings d'une catégorie.
 */
public static function latestByCategory(
    string $category,
    int $limit = 6
) {
    $cacheKey = "latest_listings_ids_" . md5($category) . "_{$limit}";

    $cacheTtl = (int) env('REDIS_CACHE_TIMING', 60);
    $ids = \Illuminate\Support\Facades\Cache::remember($cacheKey, $cacheTtl, function () use ($category, $limit) {
        return self::where('status', 'published')
            ->inCategory($category)
            ->latest('published_at')
            ->limit($limit)
            ->pluck('id')
            ->toArray();
    });

    if (empty($ids)) {
        return collect();
    }

    return self::with(['book', 'category', 'user.profile.city'])
        ->whereIn('id', $ids)
        // whereIn ne préserve pas l'ordre, on le refait en PHP
        ->get()
        ->sortByDesc('published_at')
        ->values();
}

/**
 * Filtre les listings appartenant à un utilisateur.
 */
public function scopeForUser(
    \Illuminate\Database\Eloquent\Builder $query,
    int $userId
): \Illuminate\Database\Eloquent\Builder {
    return $query->where('user_id', $userId);
}

/**
 * Retourne les dernières publications d'un utilisateur.
 */
public static function latestByUser(
    int $userId,
    int $limit = 6
): \Illuminate\Database\Eloquent\Collection {
    return static::query()
        ->with(['category'])
        ->forUser($userId)
        ->latest('created_at')
        ->limit($limit)
        ->get();
}

    public function level()
    {
        return $this->belongsTo(Level::class);
    }

    public function subject()
    {
        return $this->belongsTo(Subject::class);
    }

    public function getBreadcrumbAttribute()
    {
        $parts = [];
        if ($this->category) {
            if ($this->category->parent) {
                $parts[] = $this->category->parent->name_fr;
            }
            $parts[] = $this->category->name_fr;
        }
        if ($this->level) {
            $parts[] = $this->level->name_fr;
        }
        if ($this->subject) {
            $parts[] = $this->subject->name_fr;
        }

        if (empty($parts)) {
            return null;
        }

        return implode(' / ', $parts);
    }

    public function getUrlAttribute()
    {
        $nickname = $this->user->profile->nickname ?? 'utilisateur-' . $this->user_id;
        $slug = \Illuminate\Support\Str::slug($this->isbn_13 . '-' . $this->title);
        return url("/{$nickname}/{$this->id}-{$slug}");
    }

    public function getSellerUrlAttribute()
    {
        $nickname = $this->user->profile->nickname ?? 'utilisateur-' . $this->user_id;
        // Optionnel : Vous vouliez /nickname/profile ou juste /nickname/ ? J'utilise /nickname comme vous l'avez suggéré
        return url("/{$nickname}");
    }

    public function language()
    {
        return $this->belongsTo(Language::class);
    }

    public function packItems()
    {
        return $this->hasMany(ListingPackItem::class, 'pack_listing_id');
    }

    public function partOfPacks()
    {
        return $this->hasMany(ListingPackItem::class, 'child_listing_id');
    }

    public function packedListings()
    {
        return $this->belongsToMany(
            Listing::class,
            'listing_pack_items',
            'pack_listing_id',
            'child_listing_id'
        )->withPivot('sort_order')->withTimestamps();
    }

    public function parentPacks()
    {
        return $this->belongsToMany(
            Listing::class,
            'listing_pack_items',
            'child_listing_id',
            'pack_listing_id'
        )->withPivot('sort_order')->withTimestamps();
    }

    public function getCoverUrlAttribute(): ?string
    {
        $path = trim((string) ($this->cover_path ?? ''));

        if ($path !== '') {
            if (\Illuminate\Support\Str::startsWith($path, ['http://', 'https://'])) {
                return $path;
            }

            if (self::isUserUploadedCover($path)) {
                return asset('storage/' . $path);
            }

            // Couverture catalogue : nom de fichier simple (9782294788222.jpg)
            $cleanPath = ltrim(str_replace('originals/', '', $path), '/');
            $baseUrl = env('BOOK_COVERS_URL', url('/book-cover-proxy'));
            return rtrim($baseUrl, '/') . '/' . $cleanPath;
        }

        $external = trim((string) ($this->cover_source_url ?? ''));

        return $external !== '' ? $external : null;
    }

    public function getCoverThumbnailUrlAttribute(): ?string
    {
        return $this->getCoverThumbnailUrl(160);
    }

    public function getCoverThumbnailUrl(int $size = 160): ?string
    {
        $path = trim((string) ($this->cover_path ?? ''));

        if ($path !== '') {
            if (\Illuminate\Support\Str::startsWith($path, ['http://', 'https://'])) {
                return $path;
            }

            if (self::isUserUploadedCover($path)) {
                $filename = basename($path);
                $thumbPath = 'book-covers/user-uploads/thumbnails/' . $size . '/' . $filename;
                // If it doesn't exist, we fallback to the original user upload (though ThumbnailService should ensure it)
                if (file_exists(public_path($thumbPath))) {
                    return asset($thumbPath);
                }
                return asset($path);
            }

            $cleanPath = ltrim(str_replace('originals/', '', $path), '/');
            $cleanPathWebp = preg_replace('/\.(jpg|jpeg|png)$/i', '.webp', $cleanPath);
            $baseUrl = env('BOOK_COVERS_URL', url('/book-cover-proxy'));
            return rtrim($baseUrl, '/') . "/thumbnails/{$size}/" . $cleanPathWebp;
        }

        $external = trim((string) ($this->cover_source_url ?? ''));

        return $external !== '' ? $external : null;
    }

    /**
     * Récupère les annonces actives ou en attente pour un utilisateur (Query Builder)
     */
    public static function getActiveListingsByUser(int $userId)
    {
        return self::query()
            ->where('user_id', $userId)
            ->whereIn('status', ['published', 'pending_admin', 'active']);
    }

    /**
     * Récupère les annonces désactivées (vendues, supprimées, rejetées, etc.) pour un utilisateur (Query Builder)
     */
    public static function getDesactivatedListingsByUser(int $userId)
    {
        return self::query()
            ->where('user_id', $userId)
            ->whereIn('status', ['sold', 'deleted', 'rejected', 'hidden', 'expired']);
    }

    /**
     * Récupère toutes les annonces pour un utilisateur (Query Builder)
     */
    public static function getListingsByUser(int $userId)
    {
        return self::query()
            ->where('user_id', $userId)
            ->where('status', '!=', 'archived');
    }
}
