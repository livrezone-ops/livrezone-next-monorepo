<?php

namespace App\Services;

use App\Models\Book;

class BookDetailService
{
    /**
     * Retourne un livre avec ses relations et le nombre d'annonces actives.
     *
     * Identifiants acceptés : id interne (petit entier), ISBN-13/ISBN-10
     * (numérique, 10-13 chiffres), ou slug frontend "id-isbn-title".
     * Les ISBN étant numériques, on les distingue des IDs par longueur.
     */
    public function getByIdentifier(string $identifier): ?Book
    {
        if (is_numeric($identifier)) {
            if (strlen($identifier) >= 10) {
                // ISBN (10-13 chiffres) : jamais un ID interne
                $book = Book::where('isbn_13', $identifier)->first();

                return $book ? $this->loadDetails($book) : null;
            }

            $book = Book::find((int) $identifier);
        } else {
            $leading = (int) explode('-', $identifier)[0];
            $book = $leading > 0 ? Book::find($leading) : null;

            if (! $book) {
                $book = Book::where('isbn_13', $identifier)->first()
                    ?? Book::where('title', $identifier)->first();
            }
        }

        if (! $book) {
            return null;
        }

        return $this->loadDetails($book);
    }

    private function loadDetails(Book $book): Book
    {
        $book->load(['language', 'defaultCategory.parent', 'defaultLevel'])
            ->loadCount(['listings as active_listings_count' => function ($q) {
                $q->where('status', 'published');
            }]);

        return $book;
    }
}
