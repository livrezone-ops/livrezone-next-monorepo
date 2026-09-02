<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\ListingUpsertRequest;
use App\Models\Book;
use App\Models\Category;
use App\Models\Listing;
use App\Services\BookDataFetcherService;
use App\Services\ImageUploadService;
use App\Services\ListingProcessorService;
use App\Services\ListingValidationService;
use App\Services\SubscriptionService;
use App\Services\TelegramNotificationService;
use App\Services\ThumbnailService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ListingManagerController extends Controller
{
    public function __construct(
        protected ImageUploadService $imageUploadService,
        protected ListingProcessorService $listingProcessorService,
        protected BookDataFetcherService $bookDataFetcherService,
        protected ListingValidationService $validationService
    ) {}

    public function show(Request $request, Listing $listing)
    {
        if (! $request->user()->can('update', $listing)) {
            abort(403, 'Non autorisé');
        }

        $listing->load(['book', 'category', 'level', 'subject', 'language']);
        if ($listing->book) {
            $listing->book->setAppends(['cover_url']);
        }

        return response()->json(['listing' => $listing]);
    }

    public function store(ListingUpsertRequest $request)
    {
        $user = $request->user();
        $subscriptionService = app(SubscriptionService::class);

        if ($subscriptionService->hasReachedListingLimit($user->profile)) {
            return response()->json([
                'message' => "Vous avez atteint la limite de {$subscriptionService->getMaxListings($user->profile)} annonces gratuites. Veuillez passer à l'offre Pro pour publier sans limites.",
            ], 403);
        }

        $validated = $request->validated();

        // Pipeline commun : relations, livre lié, couverture, auteur/éditeur
        [$category, $levelId, $subjectId] = $this->resolveTaxonomy($request, $validated);
        [$book, $bookId] = $this->resolveBook($validated, null);
        [$author, $publisher] = $this->listingProcessorService->resolveAuthorPublisher($book, $validated);
        [$coverPath, $coverSourceUrl] = $this->resolveCover($request, $book, null);

        $status = $this->validationService->determineStatus(
            $validated,
            $book,
            $request->hasFile('cover_image')
        );

        $payload = [
            'user_id' => $request->user()->id,
            'listing_type' => 'single',
            'book_id' => $bookId,
            'title' => $validated['title'],
            'author' => $author,
            'publisher' => $publisher,
            'description' => $validated['description'] ?? '',
            'book_condition' => $validated['book_condition'],
            'price' => $validated['price'],
            'discount_price' => $validated['discount_price'] ?? null,
            'currency' => 'MAD',
            'quantity' => $validated['quantity'] ?? 1,
            'cover_path' => $coverPath,
            'cover_source_url' => $coverSourceUrl,
            'category_id' => $category->id,
            'level_id' => $levelId,
            'subject_id' => $subjectId,
            'language_id' => $validated['language_id'] ?? null,
            'isbn_13' => $validated['isbn_13'] ?? null,
            'status' => $status,
            'submitted_at' => now(),
        ];

        $listing = Listing::create($payload);

        // Miniatures paresseuses (160/320) de la couverture sollicitée — échec silencieux
        ThumbnailService::ensureThumbnailsExist($coverPath);

        try {
            app(TelegramNotificationService::class)->notifyAdminNewListing($listing);
        } catch (\Exception $e) {
            Log::error('Erreur envoi Telegram: '.$e->getMessage());
        }

        return response()->json([
            'message' => 'Annonce créée avec succès, en attente de validation',
            'listing' => $listing,
        ], 201);
    }

    public function update(ListingUpsertRequest $request, Listing $listing)
    {
        if (! $request->user()->can('update', $listing)) {
            abort(403, 'Non autorisé');
        }

        $validated = $request->validated();

        // Pipeline commun : relations, livre lié, couverture, auteur/éditeur
        [$category, $levelId, $subjectId] = $this->resolveTaxonomy($request, $validated);
        [$book, $bookId] = $this->resolveBook($validated, $listing);
        [$author, $publisher] = $this->listingProcessorService->resolveAuthorPublisher($book, $validated);
        [$coverPath, $coverSourceUrl] = $this->resolveCover($request, $book, $listing);

        // Déterminer si les données principales ont été altérées
        $mainDataChanged = false;

        if ($request->hasFile('cover_image')) {
            $mainDataChanged = true;
        } else {
            $normalizedTitle = mb_strtolower(trim($validated['title']));
            $normalizedOldTitle = mb_strtolower(trim($listing->title));

            $normalizedDesc = mb_strtolower(trim($validated['description'] ?? ''));
            $normalizedOldDesc = mb_strtolower(trim($listing->description ?? ''));

            $newIsbn = $validated['isbn_13'] ?? null;
            $oldIsbn = $listing->isbn_13;

            if ($normalizedTitle !== $normalizedOldTitle || $normalizedDesc !== $normalizedOldDesc || $newIsbn !== $oldIsbn) {
                $mainDataChanged = true;
            }
        }

        $status = $listing->status;

        if ($mainDataChanged) {
            $status = $this->validationService->determineStatus(
                $validated,
                $book,
                $request->hasFile('cover_image')
            );
        }

        $payload = [
            'book_id' => $bookId,
            'title' => $validated['title'],
            'author' => $author,
            'publisher' => $publisher,
            'description' => $validated['description'] ?? '',
            'book_condition' => $validated['book_condition'],
            'price' => $validated['price'],
            'discount_price' => $validated['discount_price'] ?? null,
            'quantity' => $validated['quantity'] ?? $listing->quantity ?? 1,
            'category_id' => $category->id,
            'level_id' => $levelId,
            'subject_id' => $subjectId,
            'language_id' => $validated['language_id'] ?? null,
            'isbn_13' => $validated['isbn_13'] ?? null,
            'cover_path' => $coverPath,
            'cover_source_url' => $coverSourceUrl,
            'status' => $status,
            'submitted_at' => now(),
        ];

        $oldStatus = $listing->status;
        $listing->update($payload);

        // Miniatures paresseuses (160/320) si la couverture a changé — échec silencieux
        ThumbnailService::ensureThumbnailsExist($coverPath);

        if ($oldStatus === 'published' && $status === 'pending_admin') {
            try {
                app(TelegramNotificationService::class)->notifyAdminNewListing($listing);
            } catch (\Exception $e) {
                Log::error('Erreur envoi Telegram update: '.$e->getMessage());
            }
        }

        return response()->json([
            'message' => 'Annonce mise à jour avec succès',
            'listing' => $listing,
        ]);
    }

    /**
     * Résolution partagée des relations catégorie / niveau / matière
     * (store et update).
     *
     * @param  array<string, mixed>  $validated
     * @return array{0: Category, 1: int|null, 2: int|null}
     */
    private function resolveTaxonomy(ListingUpsertRequest $request, array $validated): array
    {
        $category = Category::with(['levels', 'subjects'])->findOrFail($validated['category_id']);
        $this->listingProcessorService->validateCategoryParent($category, $request->input('parent_category_id'));

        [$levelId, $subjectId] = $this->listingProcessorService->resolveLevelSubject(
            $category,
            $validated['level_id'] ?? null,
            $validated['subject_id'] ?? null
        );

        return [$category, $levelId, $subjectId];
    }

    /**
     * Recherche du livre lié : priorité book_id, sinon ISBN.
     * En update, repli sur le livre déjà lié si aucun nouveau n'a été trouvé.
     *
     * @param  array<string, mixed>  $validated
     * @return array{0: Book|null, 1: int|null}
     */
    private function resolveBook(array $validated, ?Listing $existing): array
    {
        if ($existing !== null) {
            $bookId = $validated['book_id'] ?? $existing->book_id;
            $book = null;

            if (! empty($validated['book_id'])) {
                $book = Book::find($validated['book_id']);
            } elseif (! empty($validated['isbn_13'])) {
                $book = $this->bookDataFetcherService->findBookByIsbn($validated['isbn_13']);
            }

            if ($book) {
                $bookId = $book->id;
            }

            // Repli sur le livre déjà lié si aucun nouveau n'a été trouvé par ISBN
            if ($book === null && $existing->book_id) {
                $book = $existing->book;
            }

            return [$book, $bookId];
        }

        $bookId = $validated['book_id'] ?? null;
        $book = null;

        if ($bookId) {
            $book = Book::find($bookId);
        } elseif (! empty($validated['isbn_13'])) {
            $book = $this->bookDataFetcherService->findBookByIsbn($validated['isbn_13']);
            if ($book) {
                $bookId = $book->id;
            }
        }

        return [$book, $bookId];
    }

    /**
     * Gestion de la couverture : priorité à l'upload utilisateur,
     * sinon couverture du livre catalogue (en création, ou en update
     * uniquement si le listing n'a pas encore de couverture).
     *
     * @return array{0: string|null, 1: string|null}
     */
    private function resolveCover(ListingUpsertRequest $request, ?Book $book, ?Listing $existing): array
    {
        $coverPath = $existing?->cover_path;
        $coverSourceUrl = $existing?->cover_source_url;

        if ($book && ! $request->hasFile('cover_image') && (! $existing || ! $coverPath)) {
            $coverPath = $book->cover_path;
            $coverSourceUrl = $book->cover_source_url;
        }

        if ($request->hasFile('cover_image')) {
            // En update : suppression de l'ancienne couverture locale
            if ($existing && $coverPath && ! str_starts_with($coverPath, 'http')) {
                Storage::disk('public')->delete($coverPath);
            }

            $coverPath = $this->imageUploadService->storeCover($request->file('cover_image'));
        }

        return [$coverPath, $coverSourceUrl];
    }
}
