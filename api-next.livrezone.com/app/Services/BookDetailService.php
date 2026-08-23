<?php

namespace App\Services;

use App\Models\Book;

class BookDetailService
{
    /**
     * Retourne un livre avec ses relations et le nombre d'annonces actives.
     *
     * Recherche prioritaire par ID (clé primaire) pour éviter un full scan
     * sur 650k lignes. Le slug frontend est "id-isbn-title" : on extrait
     * l'ID en tête si l'identifiant n'est pas purement numérique.
     */
    public function getByIdentifier(string $identifier): ?Book
    {
        if (is_numeric($identifier)) {
            $book = Book::find((int) $identifier);
        } else {
            $leading = (int) explode('-', $identifier)[0];
            $book = $leading > 0 ? Book::find($leading) : null;

            if (!$book) {
                $book = Book::where('isbn_13', $identifier)->first()
                    ?? Book::where('title', $identifier)->first();
            }
        }

        if (!$book) {
            return null;
        }

        $book->load(['language', 'defaultCategory', 'defaultLevel'])
            ->loadCount(['listings as active_listings_count' => function ($q) {
                $q->where('status', 'published');
            }]);

        return $book;
    }
}
