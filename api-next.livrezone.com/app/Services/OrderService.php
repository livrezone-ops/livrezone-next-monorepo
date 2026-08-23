<?php

namespace App\Services;

use App\Models\Book;
use App\Models\Category;
use App\Models\Order;
use App\Models\User;
use App\Jobs\ProcessBookOrderNotifications;
use App\Services\ImageUploadService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class OrderService
{
    public function __construct(
        protected ImageUploadService $imageUploadService,
        protected ReferenceFilterService $filterService
    ) {}

    /**
     * Récupère la liste publique des demandes publiées avec filtres (catégorie, ville, langue, recherche).
     */
    public function getPublicDemandes(array $filters = [], int $perPage = 12)
    {
        $query = Order::query()
            ->with(['book.language', 'category', 'user.profile.city'])
            ->where('status', 'published');

        // Recherche textuelle globale (via Meilisearch avec fallback SQL)
        if (!empty($filters['search'])) {
            $search = trim($filters['search']);
            try {
                $orderIds = Order::search($search)->take(200)->keys()->all();
                $bookIds = Book::search($search)->take(200)->keys()->all();

                if (!empty($orderIds) || !empty($bookIds)) {
                    $query->where(function ($q) use ($orderIds, $bookIds) {
                        $q->whereIn('id', $orderIds)
                          ->orWhereIn('book_id', $bookIds);
                    });
                } else {
                    $this->applyTextSearchFallback($query, $search);
                }
            } catch (\Throwable $e) {
                $this->applyTextSearchFallback($query, $search);
            }
        }

        // Filtre par catégories (support des codes 'ROMANS,BD' ou IDs '1,2' avec récursion enfants)
        $categoryIds = $this->filterService->resolveCategoryIds($filters);
        if (!empty($categoryIds)) {
            $query->whereIn('category_id', $categoryIds);
        }

        // Filtre par villes (multiple) (via user.profile.city_id)
        $cityIds = $this->filterService->resolveCityIds($filters);
        if (!empty($cityIds)) {
            $query->whereHas('user.profile', function ($q) use ($cityIds) {
                $q->whereIn('city_id', $cityIds);
            });
        }

        // Filtre par langues (multiple) (via book.language_id, support codes 'fr,ar' ou IDs)
        $languageIds = $this->filterService->resolveLanguageIds($filters);
        if (!empty($languageIds)) {
            $query->whereHas('book', function ($q) use ($languageIds) {
                $q->whereIn('language_id', $languageIds);
            });
        }

        $paginated = $query->latest('published_at')->paginate($perPage);

        // Transformation optimisée pour DemandCard
        $paginated->getCollection()->transform(function ($order) {
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
        });

        return $paginated;
    }

    /**
     * Applique un fallback de recherche SQL classique (titre / auteur / isbn).
     */
    private function applyTextSearchFallback(Builder $query, string $search): void
    {
        $query->where(function ($q) use ($search) {
            $q->where('title', 'like', "%{$search}%")
              ->orWhere('author', 'like', "%{$search}%")
              ->orWhere('isbn', 'like', "%{$search}%");
        });
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

        // Vérification des doublons
        if ($bookId) {
            $existing = Order::where('user_id', $user->id)
                ->where('book_id', $bookId)
                ->whereIn('status', ['published', 'pending_admin'])
                ->first();

            if ($existing) {
                throw ValidationException::withMessages([
                    'book_id' => 'Vous avez déjà une demande active pour ce livre.'
                ]);
            }
        } elseif ($title) {
            $existing = Order::where('user_id', $user->id)
                ->where('title', $title)
                ->whereIn('status', ['published', 'pending_admin'])
                ->first();

            if ($existing) {
                throw ValidationException::withMessages([
                    'title' => 'Vous avez déjà une demande active pour ce titre.'
                ]);
            }
        }

        // Règle de modération : catalogue = published direct, manuel = pending_admin
        $isCatalogue = !empty($bookId);
        $status = $isCatalogue ? 'published' : 'pending_admin';
        $publishedAt = $isCatalogue ? now() : null;

        $order = Order::create([
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

        if ($order->status === 'published') {
            ProcessBookOrderNotifications::dispatch($order);
        }

        return $order->load(['book', 'category']);
    }

    /**
     * Met à jour une demande existante.
     */
    public function updateOrder(Order $order, array $data, ?UploadedFile $coverImage = null): Order
    {
        $coverPath = $order->cover_path;
        if ($coverImage) {
            if ($coverPath && !str_starts_with($coverPath, 'http')) {
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
