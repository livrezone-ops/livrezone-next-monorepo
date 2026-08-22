<?php

namespace App\Services;

use App\Models\Book;
use App\Models\Category;
use Illuminate\Validation\ValidationException;

class ListingProcessorService
{
    /**
     * Vérifie que la sous-catégorie appartient bien à la catégorie parente sélectionnée.
     */
    public function validateCategoryParent(Category $category, $parentId): void
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
    public function resolveLevelSubject(Category $category, ?int $levelId, ?int $subjectId): array
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

    /**
     * Résout l'auteur et l'éditeur d'un listing.
     * La saisie utilisateur a la priorité ; sinon on se rabat sur les
     * métadonnées du livre catalogue (authors est stocké en tableau).
     *
     * @return array{0: string|null, 1: string|null} [author, publisher]
     */
    public function resolveAuthorPublisher(?Book $book, array $validated): array
    {
        $author = $validated['author'] ?? null;
        if ($author === null || trim($author) === '') {
            $author = null;
            if ($book) {
                $authors = is_array($book->authors) ? $book->authors : [];
                if (!empty($authors)) {
                    $author = implode(', ', array_filter(array_map('trim', $authors)));
                }
            }
        }

        $publisher = $validated['publisher'] ?? null;
        if ($publisher === null || trim($publisher) === '') {
            $publisher = null;
            if ($book && !empty($book->publisher)) {
                $publisher = $book->publisher;
            }
        }

        return [$author, $publisher];
    }
}
