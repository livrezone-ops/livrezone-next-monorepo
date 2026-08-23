<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\Category;
use App\Models\Listing;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use App\Services\ImageUploadService;
use App\Services\ListingProcessorService;
use App\Services\BookDataFetcherService;
use App\Services\ListingValidationService;
use App\Services\TelegramNotificationService;

class ListingManagerController extends Controller
{
    public function __construct(
        protected ImageUploadService $imageUploadService,
        protected ListingProcessorService $listingProcessorService,
        protected BookDataFetcherService $bookDataFetcherService,
        protected ListingValidationService $validationService,
        protected TelegramNotificationService $telegramService
    ) {}

    public function show(Request $request, Listing $listing)
    {
        if ($listing->user_id !== $request->user()->id) {
            abort(403, 'Non autorisé');
        }
        
        $listing->load(['book', 'category', 'level', 'subject', 'language']);
        if ($listing->book) {
            $listing->book->setAppends(['cover_url']);
        }

        return response()->json(['listing' => $listing]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $promoProFree = filter_var(env('PROMO_PRO_FREE', false), FILTER_VALIDATE_BOOLEAN);
        $maxFreeListings = (int) env('MAX_FREE_LISTINGS', 25);
        $subscriptionType = $user->profile->subscription_type ?? 'free';
        
        if (!$promoProFree && $subscriptionType === 'free') {
            $activeCount = Listing::where('user_id', $user->id)
                                  ->whereIn('status', ['published', 'pending_admin', 'pending_stock'])
                                  ->count();
            
            if ($activeCount >= $maxFreeListings) {
                return response()->json([
                    'message' => "Vous avez atteint la limite de {$maxFreeListings} annonces gratuites. Veuillez passer à l'offre Pro pour publier sans limites."
                ], 403);
            }
        }

        $validated = $this->validateListing($request);

        // Résolution des relations catégorie / niveau / matière
        $category = Category::with(['levels', 'subjects'])->findOrFail($validated['category_id']);
        $this->listingProcessorService->validateCategoryParent($category, $request->input('parent_category_id'));
        
        [$levelId, $subjectId] = $this->listingProcessorService->resolveLevelSubject(
            $category,
            $validated['level_id'] ?? null,
            $validated['subject_id'] ?? null
        );

        // Recherche du livre (par book_id ou ISBN) pour lier et récupérer la couverture catalogue
        $book = null;
        $bookId = $validated['book_id'] ?? null;
        $bookCoverPath = null;
        $bookCoverSourceUrl = null;

        if ($bookId) {
            $book = Book::find($bookId);
            if ($book) {
                $bookCoverPath = $book->cover_path;
                $bookCoverSourceUrl = $book->cover_source_url;
            }
        } elseif (!empty($validated['isbn_13'])) {
            $book = $this->bookDataFetcherService->findBookByIsbn($validated['isbn_13']);
            if ($book) {
                $bookId = $book->id;
                $bookCoverPath = $book->cover_path;
                $bookCoverSourceUrl = $book->cover_source_url;
            }
        }

        [$author, $publisher] = $this->listingProcessorService->resolveAuthorPublisher($book, $validated);

        // Gestion de la couverture : priorité à l'upload utilisateur > couverture du book catalogue
        $coverPath = null;
        $coverSourceUrl = null;

        if ($request->hasFile('cover_image')) {
            $coverPath = $this->imageUploadService->storeCover($request->file('cover_image'));
        } elseif ($bookCoverPath) {
            // Utiliser la couverture du livre catalogue (chemin relatif)
            $coverPath = $bookCoverPath;
            $coverSourceUrl = $bookCoverSourceUrl;
        }

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

        try {
            $this->telegramService->sendNewListingNotification($listing);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Erreur envoi Telegram: ' . $e->getMessage());
        }

        return response()->json([
            'message' => 'Annonce créée avec succès, en attente de validation',
            'listing' => $listing
        ], 201);
    }

    public function update(Request $request, Listing $listing)
    {
        if ($listing->user_id !== $request->user()->id) {
            abort(403, 'Non autorisé');
        }

        $validated = $this->validateListing($request);

        // Résolution des relations catégorie / niveau / matière
        $category = Category::with(['levels', 'subjects'])->findOrFail($validated['category_id']);
        $this->listingProcessorService->validateCategoryParent($category, $request->input('parent_category_id'));
        
        [$levelId, $subjectId] = $this->listingProcessorService->resolveLevelSubject(
            $category,
            $validated['level_id'] ?? null,
            $validated['subject_id'] ?? null
        );

        // Recherche du livre par book_id ou ISBN pour mettre à jour le lien book_id
        $bookId = $validated['book_id'] ?? $listing->book_id;
        $coverPath = $listing->cover_path;
        $coverSourceUrl = $listing->cover_source_url;
        $book = null;

        if (!empty($validated['book_id'])) {
            $book = Book::find($validated['book_id']);
        } elseif (!empty($validated['isbn_13'])) {
            $book = $this->bookDataFetcherService->findBookByIsbn($validated['isbn_13']);
        }

        if ($book) {
            $bookId = $book->id;
            // Si le listing n'a pas encore de couverture, utiliser celle du book catalogue
            if (!$coverPath && !$request->hasFile('cover_image')) {
                $coverPath = $book->cover_path;
                $coverSourceUrl = $book->cover_source_url;
            }
        }

        // Repli sur le livre déjà lié si aucun nouveau n'a été trouvé par ISBN
        if ($book === null && $listing->book_id) {
            $book = $listing->book;
        }

        [$author, $publisher] = $this->listingProcessorService->resolveAuthorPublisher($book, $validated);

        // Upload d'une nouvelle couverture utilisateur (prioritaire)
        if ($request->hasFile('cover_image')) {
            if ($coverPath && !str_starts_with($coverPath, 'http')) {
                Storage::disk('public')->delete($coverPath);
            }
            $coverPath = $this->imageUploadService->storeCover($request->file('cover_image'));
        }

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

        if ($oldStatus === 'published' && $status === 'pending_admin') {
            try {
                $this->telegramService->sendNewListingNotification($listing);
            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::error('Erreur envoi Telegram update: ' . $e->getMessage());
            }
        }

        return response()->json([
            'message' => 'Annonce mise à jour avec succès',
            'listing' => $listing
        ]);
    }

    private function validateListing(Request $request)
    {
        return $request->validate([
            'book_id' => 'nullable|integer|exists:books,id',
            'title' => 'required|string|max:255',
            'author' => 'nullable|string|max:255',
            'publisher' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'book_condition' => 'required|in:neuf,occas',
            'price' => 'required|numeric|min:0',
            'discount_price' => 'nullable|numeric|min:0|lt:price',
            'quantity' => 'nullable|integer|min:1',
            'category_id' => 'required|exists:categories,id',
            'parent_category_id' => 'nullable|integer|exists:categories,id',
            'level_id' => 'nullable|integer',
            'subject_id' => 'nullable|integer',
            'language_id' => 'nullable|exists:languages,id',
            'isbn_13' => 'nullable|string|max:20',
            'cover_image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:4096',
            'cover_source_url' => 'nullable|url'
        ]);
    }
}
