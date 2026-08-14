<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\Category;
use App\Models\Listing;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Intervention\Image\Encoders\WebpEncoder;
use Intervention\Image\Laravel\Facades\Image;

class ListingManagerController extends Controller
{
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
        $validated = $this->validateListing($request);

        // Résolution des relations catégorie / niveau / matière
        $category = Category::with(['levels', 'subjects'])->findOrFail($validated['category_id']);
        $this->validateCategoryParent($category, $request->input('parent_category_id'));
        [$levelId, $subjectId] = $this->resolveLevelSubject(
            $category,
            $validated['level_id'] ?? null,
            $validated['subject_id'] ?? null
        );

        // Recherche du livre par ISBN pour lier book_id et récupérer la couverture catalogue
        $book = null;
        $bookId = null;
        $bookCoverPath = null;
        $bookCoverSourceUrl = null;

        if (!empty($validated['isbn_13'])) {
            $book = Book::where('isbn_13', $validated['isbn_13'])->first();
            if ($book) {
                $bookId = $book->id;
                $bookCoverPath = $book->cover_path;
                $bookCoverSourceUrl = $book->cover_source_url;
            }
        }

        // Gestion de la couverture : priorité à l'upload utilisateur > couverture du book catalogue
        $coverPath = null;
        $coverSourceUrl = null;

        if ($request->hasFile('cover_image')) {
            $coverPath = $this->storeCover($request->file('cover_image'));
        } elseif ($bookCoverPath) {
            // Utiliser la couverture du livre catalogue (chemin relatif)
            $coverPath = $bookCoverPath;
            $coverSourceUrl = $bookCoverSourceUrl;
        }

        $payload = [
            'user_id' => $request->user()->id,
            'listing_type' => 'single',
            'book_id' => $bookId,
            'title' => $validated['title'],
            'description' => $validated['description'] ?? '',
            'book_condition' => $validated['book_condition'],
            'price' => $validated['price'],
            'discount_price' => $validated['discount_price'] ?? null,
            'currency' => 'MAD',
            'quantity' => 1,
            'cover_path' => $coverPath,
            'cover_source_url' => $coverSourceUrl,
            'category_id' => $category->id,
            'level_id' => $levelId,
            'subject_id' => $subjectId,
            'language_id' => $validated['language_id'] ?? null,
            'isbn_13' => $validated['isbn_13'] ?? null,
            'status' => 'pending_admin',
            'submitted_at' => now(),
        ];

        $listing = Listing::create($payload);

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
        $this->validateCategoryParent($category, $request->input('parent_category_id'));
        [$levelId, $subjectId] = $this->resolveLevelSubject(
            $category,
            $validated['level_id'] ?? null,
            $validated['subject_id'] ?? null
        );

        // Recherche du livre par ISBN pour mettre à jour le lien book_id
        $bookId = $listing->book_id;
        $coverPath = $listing->cover_path;
        $coverSourceUrl = $listing->cover_source_url;

        if (!empty($validated['isbn_13'])) {
            $book = Book::where('isbn_13', $validated['isbn_13'])->first();
            if ($book) {
                $bookId = $book->id;
                // Si le listing n'a pas encore de couverture, utiliser celle du book catalogue
                if (!$coverPath && !$request->hasFile('cover_image')) {
                    $coverPath = $book->cover_path;
                    $coverSourceUrl = $book->cover_source_url;
                }
            }
        }

        // Upload d'une nouvelle couverture utilisateur (prioritaire)
        if ($request->hasFile('cover_image')) {
            if ($coverPath && !str_starts_with($coverPath, 'http')) {
                Storage::disk('public')->delete($coverPath);
            }
            $coverPath = $this->storeCover($request->file('cover_image'));
        }

        $payload = [
            'book_id' => $bookId,
            'title' => $validated['title'],
            'description' => $validated['description'] ?? '',
            'book_condition' => $validated['book_condition'],
            'price' => $validated['price'],
            'discount_price' => $validated['discount_price'] ?? null,
            'quantity' => 1,
            'category_id' => $category->id,
            'level_id' => $levelId,
            'subject_id' => $subjectId,
            'language_id' => $validated['language_id'] ?? null,
            'isbn_13' => $validated['isbn_13'] ?? null,
            'cover_path' => $coverPath,
            'cover_source_url' => $coverSourceUrl,
            'status' => 'pending_admin',
            'submitted_at' => now(),
        ];

        $listing->update($payload);

        return response()->json([
            'message' => 'Annonce mise à jour avec succès',
            'listing' => $listing
        ]);
    }

    private function validateListing(Request $request)
    {
        return $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'book_condition' => 'required|in:neuf,occas',
            'price' => 'required|numeric|min:0',
            'discount_price' => 'nullable|numeric|min:0|lt:price',
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

    /**
     * Vérifie que la sous-catégorie appartient bien à la catégorie parente sélectionnée.
     */
    private function validateCategoryParent(Category $category, $parentId): void
    {
        if ($parentId !== null && (int) $parentId !== (int) $category->parent_id) {
            throw ValidationException::withMessages([
                'category_id' => 'La sous-catégorie sélectionnée n\'appartient pas à la catégorie parente choisie.',
            ]);
        }
    }

    /**
     * Résout le niveau et la matière en respectant les relations de la catégorie
     * (category_level / category_subject). Impose « Non applicable » quand la
     * relation l'exige, et rejette toute valeur non autorisée.
     *
     * @return array{0: int|null, 1: int|null} [level_id, subject_id]
     */
    private function resolveLevelSubject(Category $category, ?int $levelId, ?int $subjectId): array
    {
        $allowedLevels = $category->levels;
        $allowedSubjects = $category->subjects;

        $naLevel = $allowedLevels->first(fn ($l) => $l->code === 'NON_APPLICABLE');
        $levelIsNA = $allowedLevels->count() === 0 || ($allowedLevels->count() === 1 && $naLevel !== null);

        if ($levelIsNA) {
            $levelId = $naLevel?->id ?? null;
        } elseif ($levelId !== null && !in_array($levelId, $allowedLevels->pluck('id')->all(), true)) {
            throw ValidationException::withMessages([
                'level_id' => 'Le niveau sélectionné n\'est pas autorisé pour cette catégorie.',
            ]);
        }

        $naSubject = $allowedSubjects->first(fn ($s) => $s->code === 'NON_APPLICABLE');
        $subjectIsNA = $allowedSubjects->count() === 0 || ($allowedSubjects->count() === 1 && $naSubject !== null);

        if ($subjectIsNA) {
            $subjectId = $naSubject?->id ?? null;
        } elseif ($subjectId !== null && !in_array($subjectId, $allowedSubjects->pluck('id')->all(), true)) {
            throw ValidationException::withMessages([
                'subject_id' => 'La matière sélectionnée n\'est pas autorisée pour cette catégorie.',
            ]);
        }

        return [$levelId, $subjectId];
    }

    private function storeCover($file)
    {
        $filename = 'covers/users/' . Str::random(20) . '.webp';
        
        $image = Image::read($file->getRealPath())
            ->scaleDown(width: 800)
            ->encode(new WebpEncoder(quality: 82));
            
        Storage::disk('public')->put($filename, (string) $image);
        
        return $filename;
    }
}

