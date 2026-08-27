<?php

namespace App\Models;

use App\Traits\HasCoverUrls;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Laravel\Scout\Searchable;

class Listing extends Model
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
            'isbn_13' => $this->isbn_13,
            'author' => $this->author,
            'publisher' => $this->publisher,
            'category_id' => (int) $this->category_id,
            'language_id' => (int) $this->language_id,
            'level_id' => (int) $this->level_id,
            'book_condition' => $this->book_condition,
            'status' => $this->status,
            'city_id' => $this->user && $this->user->profile ? (int) $this->user->profile->city_id : 0,
        ];
    }

    // ----------------------------------------------------------------
    // Sécurité des couvertures (logique partagée : trait HasCoverUrls)

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
        'author',
        'publisher',
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

        if (! $selectedCategory) {
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
        $cacheKey = 'latest_listings_ids_'.md5($category)."_{$limit}";

        $cacheTtl = (int) env('REDIS_CACHE_TIMING', 60);
        $ids = Cache::remember($cacheKey, $cacheTtl, function () use ($category, $limit) {
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
        Builder $query,
        int $userId
    ): Builder {
        return $query->where('user_id', $userId);
    }

    /**
     * Retourne les dernières publications d'un utilisateur.
     */
    public static function latestByUser(
        int $userId,
        int $limit = 6
    ): Collection {
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
        $nickname = $this->user->profile->nickname ?? 'utilisateur-'.$this->user_id;
        $slug = Str::slug($this->isbn_13.'-'.$this->title);

        return url("/{$nickname}/{$this->id}-{$slug}");
    }

    public function getSellerUrlAttribute()
    {
        $nickname = $this->user->profile->nickname ?? 'utilisateur-'.$this->user_id;

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
