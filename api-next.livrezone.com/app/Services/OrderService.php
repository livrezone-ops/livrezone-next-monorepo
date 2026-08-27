<?php

namespace App\Services;

use App\Jobs\ProcessBookOrderNotifications;
use App\Models\Book;
use App\Models\Category;
use App\Models\Language;
use App\Models\Listing;
use App\Models\Order;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Pagination\AbstractPaginator;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class OrderService
{
    public function __construct(
        protected ImageUploadService $imageUploadService,
        protected ReferenceFilterService $filterService,
        protected SubscriptionService $subscriptionService
    ) {}

    /**
     * Récupère la liste publique des demandes publiées avec filtres (catégorie, ville, langue, recherche).
     * Recherche + filtres + pagination + facettes sont DÉLÉGUÉS à Meilisearch (index "orders"),
     * sans scanner MySQL. Le total provient de estimatedTotalHits.
     */
    public function getPublicDemandes(array $filters = [], int $perPage = 12, ?User $viewer = null): array
    {
        $search = trim($filters['search'] ?? '');

        $categoryIds = $this->filterService->resolveCategoryIds($filters);
        $cityIds = $this->filterService->resolveCityIds($filters);
        $languageIds = $this->filterService->resolveLanguageIds($filters);

        try {
            // --- 1. Facettes (sans le filtre ville pour garder la liste de villes complète) ---
            $facetBuilder = Order::search($search, function ($meilisearch, $query, $options) {
                $options['facets'] = ['category_id', 'city_id', 'language_id'];
                $options['hitsPerPage'] = 0; // On ne veut que les facettes

                return $meilisearch->search($query, $options);
            });
            $facetBuilder->where('status', 'published');
            if (! empty($categoryIds)) {
                $facetBuilder->whereIn('category_id', $categoryIds);
            }
            if (! empty($languageIds)) {
                $facetBuilder->whereIn('language_id', $languageIds);
            }

            $rawFacets = $facetBuilder->raw();
            $cityFacets = $rawFacets['facetDistribution']['city_id'] ?? [];
            $categoryFacets = $rawFacets['facetDistribution']['category_id'] ?? [];
            $languageFacets = $rawFacets['facetDistribution']['language_id'] ?? [];

            $categoryMap = Cache::remember('category_code_map', 3600, function () {
                return Category::pluck('code', 'id')->toArray();
            });
            $languageMap = Cache::remember('language_code_map', 3600, function () {
                return Language::pluck('code', 'id')->toArray();
            });

            $mappedCategories = [];
            foreach ($categoryFacets as $id => $count) {
                $code = $categoryMap[$id] ?? $id;
                $mappedCategories[$code] = ($mappedCategories[$code] ?? 0) + $count;
            }
            $mappedLanguages = [];
            foreach ($languageFacets as $id => $count) {
                $code = $languageMap[$id] ?? $id;
                $mappedLanguages[$code] = ($mappedLanguages[$code] ?? 0) + $count;
            }
            $mappedCities = [];
            foreach ($cityFacets as $id => $count) {
                $mappedCities[(string) $id] = $count;
            }

            // --- 2. Requête principale (avec tous les filtres) ---
            $builder = Order::search($search);
            $builder->where('status', 'published');
            if (! empty($categoryIds)) {
                $builder->whereIn('category_id', $categoryIds);
            }
            if (! empty($cityIds)) {
                $builder->whereIn('city_id', $cityIds);
            }
            if (! empty($languageIds)) {
                $builder->whereIn('language_id', $languageIds);
            }
            $builder->orderBy('published_at', 'desc');

            $paginated = $builder->paginate($perPage);

            // Les ~12 demandes sont hydratées par Scout depuis MySQL : on charge les relations.
            $paginated->getCollection()->load(['book.language', 'category', 'user.profile.city']);

            // Visibilité selon l'abonnement du viewer (Free invisible, Pro avec délai, Premium immédiat)
            $this->applyVisibility($paginated, $viewer);

            // Transformation optimisée pour DemandCard
            $paginated->getCollection()->transform(fn ($order) => $this->transformOrder($order));

            $response = $paginated->toArray();
            $response['can_view_demandes'] = $this->canViewDemandes($viewer);
            $response['facets'] = [
                'categories' => $mappedCategories,
                'languages' => $mappedLanguages,
                'cities' => $mappedCities,
            ];

            return $response;
        } catch (\Throwable $e) {
            Log::warning('Demandes Meilisearch indisponible, repli SQL : '.$e->getMessage());

            return $this->getPublicDemandesFallback($filters, $perPage, $viewer);
        }
    }

    /**
     * Indique si le viewer peut consulter les demandes de livres.
     * Free : non. Pro / Premium : oui.
     */
    public function canViewDemandes(?User $viewer): bool
    {
        return $this->subscriptionService->canViewDemandes($viewer?->profile);
    }

    /**
     * Applique la règle de visibilité des demandes selon l'abonnement du viewer :
     * - Free    : aucune demande visible.
     * - Pro     : uniquement les demandes publiées depuis plus de PRO_NOTIFICATION_DELAY_HOURS.
     * - Premium : toutes les demandes publiées.
     */
    private function applyVisibility(AbstractPaginator $paginator, ?User $viewer): void
    {
        $profile = $viewer?->profile;

        if (! $this->subscriptionService->canViewDemandes($profile)) {
            $paginator->setCollection(collect());

            return;
        }

        $threshold = $this->subscriptionService->getDemandesVisibilityThreshold($profile);

        if ($threshold !== null) {
            $filtered = $paginator->getCollection()->filter(function ($order) use ($threshold) {
                $date = $order->published_at ?? $order->created_at;

                return $date !== null && $date <= $threshold;
            });

            $paginator->setCollection($filtered->values());
        }
    }

    /**
     * Transformation d'une demande pour DemandCard (partagée avec le repli SQL).
     */
    private function transformOrder($order): array
    {
        $profile = $order->user?->profile;
        $city = $profile?->city;

        return [
            'id' => $order->id,
            'book_id' => $order->book_id,
            'title' => $order->title,
            'author' => $order->author,
            'isbn' => $order->isbn,
            'category_id' => $order->category_id,
            'category_name' => $order->category?->name_fr ?? $order->category?->name,
            'cover_url' => $order->cover_url,
            'cover_thumbnail_url' => $order->getCoverThumbnailUrl(160),
            'cover_thumbnail_url_320' => $order->getCoverThumbnailUrl(320),
            'comment' => $order->comment,
            'status' => $order->status,
            'published_at' => $order->published_at?->toIso8601String(),
            'date_ago' => $order->published_at ? $order->published_at->locale('fr')->diffForHumans() : ($order->created_at ? $order->created_at->locale('fr')->diffForHumans() : null),
            'user' => [
                'id' => $order->user_id,
                'name' => $order->user?->name,
                'nickname' => $profile?->nickname,
                'city' => $city ? [
                    'id' => $city->id,
                    'name' => $city->name ?? $city->name_fr,
                    'name_fr' => $city->name_fr ?? $city->name,
                ] : null,
                'phone' => $profile?->phone,
                'has_whatsapp' => (bool) ($profile?->has_whatsapp ?? false),
            ],
            'language' => $order->book?->language ? [
                'id' => $order->book->language->id,
                'name_fr' => $order->book->language->name_fr ?? $order->book->language->name,
            ] : null,
        ];
    }

    /**
     * Repli SQL si Meilisearch est indisponible : demandes publiées filtrées,
     * sans facettes (la liste de villes repasse à vide, mais les demandes restent affichées).
     */
    private function getPublicDemandesFallback(array $filters, int $perPage, ?User $viewer = null): array
    {
        $query = Order::query()
            ->with(['book.language', 'category', 'user.profile.city'])
            ->where('status', 'published');

        if (! empty($filters['search'])) {
            $search = trim($filters['search']);
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('author', 'like', "%{$search}%")
                    ->orWhere('isbn', 'like', "%{$search}%");
            });
        }

        $categoryIds = $this->filterService->resolveCategoryIds($filters);
        if (! empty($categoryIds)) {
            $query->whereIn('category_id', $categoryIds);
        }

        $cityIds = $this->filterService->resolveCityIds($filters);
        if (! empty($cityIds)) {
            $query->whereHas('user.profile', function ($q) use ($cityIds) {
                $q->whereIn('city_id', $cityIds);
            });
        }

        $languageIds = $this->filterService->resolveLanguageIds($filters);
        if (! empty($languageIds)) {
            $query->whereHas('book', function ($q) use ($languageIds) {
                $q->whereIn('language_id', $languageIds);
            });
        }

        $paginated = $query->latest('published_at')->paginate($perPage);

        $this->applyVisibility($paginated, $viewer);

        $paginated->getCollection()->transform(fn ($order) => $this->transformOrder($order));

        $response = $paginated->toArray();
        $response['facets'] = ['categories' => [], 'languages' => [], 'cities' => []];
        $response['can_view_demandes'] = $this->canViewDemandes($viewer);

        return $response;
    }

    /**
     * Récupère la liste des demandes d'un utilisateur selon le statut.
     */
    public function getUserOrders(User $user, ?string $status = 'published')
    {
        $query = Order::with(['book', 'category'])
            ->where('user_id', $user->id);

        if ($status && $status !== 'all') {
            $query->where('status', $status);
        }

        return $query->orderByDesc('created_at')->get();
    }

    /**
     * Liste paginée GLOBALE des demandes (admin uniquement).
     *
     * @return array{orders: array, meta: array}
     */
    public function listForAdmin(array $filters = []): array
    {
        $query = Order::query()->with(['book', 'category', 'user.profile']);

        $status = $filters['status'] ?? 'all';
        if ($status && $status !== 'all') {
            $query->where('status', $status);
        }

        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('orders.title', 'like', "%{$search}%")
                    ->orWhere('orders.isbn', 'like', "%{$search}%")
                    ->orWhere('orders.author', 'like', "%{$search}%")
                    ->orWhereHas('user.profile', function ($pq) use ($search) {
                        $pq->where('nickname', 'like', "%{$search}%");
                    });
            });
        }

        $sortBy = in_array($filters['sort_by'] ?? null, ['created_at', 'title'], true)
            ? $filters['sort_by']
            : 'created_at';
        $sortDir = ($filters['sort_dir'] ?? 'desc') === 'asc' ? 'asc' : 'desc';
        $query->orderBy($sortBy, $sortDir);

        $orders = $query->paginate(min((int) ($filters['limit'] ?? 20), 100));

        return [
            'orders' => collect($orders->items())
                ->map(fn (Order $order) => $this->transformAdminOrder($order))
                ->all(),
            'meta' => [
                'current_page' => $orders->currentPage(),
                'last_page' => $orders->lastPage(),
                'total' => $orders->total(),
                'status_counts' => $this->adminStatusCounts(),
            ],
        ];
    }

    private function transformAdminOrder(Order $order): array
    {
        return [
            'id' => $order->id,
            'title' => $order->title,
            'author' => $order->author,
            'isbn' => $order->isbn,
            'cover_url' => $order->cover_url,
            'status' => $order->status,
            'comment' => $order->comment,
            'category' => $order->category?->name,
            'user' => $order->user ? [
                'id' => $order->user->id,
                'email' => $order->user->email,
                'nickname' => $order->user->profile?->nickname,
            ] : null,
            'created_at' => $order->created_at?->toISOString(),
            'published_at' => $order->published_at?->toISOString(),
        ];
    }

    private function adminStatusCounts(): array
    {
        $counts = Order::query()
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return [
            'pending' => (int) ($counts['pending_admin'] ?? 0),
            'published' => (int) ($counts['published'] ?? 0),
            'fulfilled' => (int) ($counts['fulfilled'] ?? 0),
            'cancelled' => (int) ($counts['cancelled'] ?? 0),
            'rejected' => (int) ($counts['rejected'] ?? 0),
        ];
    }

    /**
     * Crée une nouvelle demande (catalogue ou manuelle).
     */
    public function createOrder(User $user, array $data, ?UploadedFile $coverImage = null): Order
    {
        $bookId = $data['book_id'] ?? null;
        $book = null;

        if ($bookId) {
            $book = Book::find($bookId);
        }

        // Pré-remplissage depuis le livre catalogue si lié
        $title = $book ? $book->title : ($data['title'] ?? null);
        $author = $data['author'] ?? ($book ? (is_array($book->authors) ? implode(', ', $book->authors) : $book->authors) : null);
        $isbn = $data['isbn'] ?? ($book ? $book->isbn_13 : null);
        $categoryId = $data['category_id'] ?? ($book ? $book->default_category_id : null);
        $coverPath = null;

        if ($coverImage) {
            $coverPath = $this->imageUploadService->storeCover($coverImage);
        } elseif ($book && $book->cover_path) {
            $coverPath = $book->cover_path;
        }

        // Vérification des doublons (verrouillée pour éviter les doublons en cas de soumission concurrente)
        $order = DB::transaction(function () use ($user, $bookId, $title, $author, $isbn, $categoryId, $coverPath, $data) {
            if ($bookId) {
                $existing = Order::where('user_id', $user->id)
                    ->where('book_id', $bookId)
                    ->whereIn('status', ['published', 'pending_admin'])
                    ->lockForUpdate()
                    ->first();

                if ($existing) {
                    throw ValidationException::withMessages([
                        'book_id' => 'Vous avez déjà une demande active pour ce livre.',
                    ]);
                }
            } elseif ($title) {
                $existing = Order::where('user_id', $user->id)
                    ->where('title', $title)
                    ->whereIn('status', ['published', 'pending_admin'])
                    ->lockForUpdate()
                    ->first();

                if ($existing) {
                    throw ValidationException::withMessages([
                        'title' => 'Vous avez déjà une demande active pour ce titre.',
                    ]);
                }
            }

            // Règle de modération : catalogue = published direct, manuel = pending_admin
            $isCatalogue = ! empty($bookId);
            $status = $isCatalogue ? 'published' : 'pending_admin';
            $publishedAt = $isCatalogue ? now() : null;

            return Order::create([
                'user_id' => $user->id,
                'book_id' => $bookId,
                'title' => $title,
                'author' => $author,
                'isbn' => $isbn,
                'category_id' => $categoryId,
                'cover_path' => $coverPath,
                'comment' => $data['comment'] ?? null,
                'status' => $status,
                'published_at' => $publishedAt,
            ]);
        });

        if ($order->status === 'published') {
            ProcessBookOrderNotifications::dispatch($order);
        }

        // Miniatures paresseuses (160/320) de la couverture catalogue demandée — échec silencieux
        ThumbnailService::ensureThumbnailsExist($order->cover_path);

        // Signal front : le livre demandé est déjà en vente sur le site →
        // le client peut afficher « voir les vendeurs » (/annonces?isbn=...).
        $order->available_listings_count = $this->countMatchingListings($order);

        return $order->load(['book', 'category']);
    }

    /**
     * Nombre d'annonces publiées correspondant à une demande (ISBN ou titre normalisé).
     */
    public function countMatchingListings(Order $order): int
    {
        if (empty($order->isbn) && empty($order->title)) {
            return 0;
        }

        $normalizedTitle = mb_strtolower(trim((string) $order->title));

        return (int) Listing::where('status', 'published')
            ->where(function ($q) use ($order, $normalizedTitle) {
                if (! empty($order->isbn)) {
                    $q->orWhere('isbn_13', $order->isbn);
                }
                if ($normalizedTitle !== '') {
                    $q->orWhereRaw('LOWER(TRIM(title)) = ?', [$normalizedTitle]);
                }
            })
            ->count();
    }

    /**
     * Met à jour une demande existante.
     */
    public function updateOrder(Order $order, array $data, ?UploadedFile $coverImage = null): Order
    {
        $coverPath = $order->cover_path;
        if ($coverImage) {
            if ($coverPath && ! str_starts_with($coverPath, 'http')) {
                Storage::disk('public')->delete($coverPath);
            }
            $coverPath = $this->imageUploadService->storeCover($coverImage);
        }

        $order->update([
            'title' => $data['title'] ?? $order->title,
            'author' => $data['author'] ?? $order->author,
            'isbn' => $data['isbn'] ?? $order->isbn,
            'category_id' => $data['category_id'] ?? $order->category_id,
            'cover_path' => $coverPath,
            'comment' => $data['comment'] ?? $order->comment,
        ]);

        // Miniatures paresseuses (160/320) si la couverture catalogue a changé — échec silencieux
        ThumbnailService::ensureThumbnailsExist($coverPath);

        return $order->fresh()->load(['book', 'category']);
    }

    /**
     * Annule une demande.
     */
    public function cancelOrder(Order $order): Order
    {
        $order->update(['status' => 'cancelled']);

        return $order;
    }
}
