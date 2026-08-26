<?php

namespace App\Services;

use App\Models\Book;
use App\Models\Listing;

class ListingValidationService
{
    /**
     * Détermine le statut d'une annonce (published vs pending_admin).
     *
     * Une annonce passe directement en "published" si :
     * 1. Elle est rattachée à un livre du catalogue (Book par ISBN ou book_id).
     * 2. Elle n'utilise pas de couverture personnalisée uploadée par l'utilisateur.
     * 3. Le titre et la description correspondent aux métadonnées du catalogue.
     *
     * @param  Listing|array  $listing  Modèle Listing ou tableau de données
     * @param  Book|null  $book  Modèle Book optionnel
     * @param  bool  $hasCustomCover  Indique si une image a été uploadée
     * @return string 'published' | 'pending_admin'
     */
    public function determineStatus($listing, ?Book $book = null, bool $hasCustomCover = false): string
    {
        if ($hasCustomCover) {
            return 'pending_admin';
        }

        if ($listing instanceof Listing) {
            $book = $book ?? $listing->book;
            if (! $book && $listing->book_id) {
                $book = Book::find($listing->book_id);
            }
            if (! $book && ! empty($listing->isbn_13)) {
                $book = Book::where('isbn_13', $listing->isbn_13)->first();
            }

            // Vérification de la couverture uploadée
            $cover = $listing->cover_path ?? '';
            if (Listing::isUserUploadedCover($cover) || str_starts_with($cover, 'covers/users/')) {
                return 'pending_admin';
            }

            $title = $listing->title;
            $description = $listing->description ?? '';
        } else {
            $title = $listing['title'] ?? '';
            $description = $listing['description'] ?? '';
        }

        if (! $book) {
            return 'pending_admin';
        }

        $normalizedTitle = mb_strtolower(trim($title));
        $normalizedBookTitle = mb_strtolower(trim($book->title));

        $normalizedDesc = mb_strtolower(trim($description));
        $normalizedBookDesc = mb_strtolower(trim($book->description ?? ''));

        if ($normalizedTitle === $normalizedBookTitle && (empty($normalizedDesc) || $normalizedDesc === $normalizedBookDesc)) {
            return 'published';
        }

        return 'pending_admin';
    }

    /**
     * Détermine le statut lors de la republication d'une annonce.
     */
    public function determineRepublishStatus(Listing $listing): string
    {
        return $this->determineStatus($listing);
    }
}
