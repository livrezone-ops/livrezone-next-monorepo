<?php

namespace App\Services;

use App\Models\Book;
use Illuminate\Http\Request;

class BookAutocompleteService
{
    /**
     * Recherche instantanée (typeahead) de livres via Meilisearch avec vignettes.
     */
    public function suggest(Request $request): array
    {
        $query = trim((string) $request->get('q', ''));
        $limit = $request->integer('limit', 6);

        if (empty($query)) {
            return [];
        }

        try {
            $books = Book::search($query)->take($limit)->get();

            return $books->map(function ($book) {
                return [
                    'id' => $book->id,
                    'title' => $book->title,
                    'authors' => is_array($book->authors) ? implode(', ', $book->authors) : $book->authors,
                    'isbn_13' => $book->isbn_13,
                    'cover_url' => $book->cover_url,
                    'cover_thumbnail_url' => $book->getCoverThumbnailUrl(160),
                ];
            })->all();
        } catch (\Throwable $e) {
            // Fallback SQL si Meilisearch est momentanément indisponible
            $cleanIsbn = str_replace(['-', ' '], '', $query);
            $books = Book::query()
                ->where(function ($q) use ($query, $cleanIsbn) {
                    $q->where('title', 'like', "%{$query}%")
                      ->orWhere('authors', 'like', "%{$query}%")
                      ->orWhere('isbn_13', 'like', "%{$cleanIsbn}%");
                })
                ->take($limit)
                ->get();

            return $books->map(function ($book) {
                return [
                    'id' => $book->id,
                    'title' => $book->title,
                    'authors' => is_array($book->authors) ? implode(', ', $book->authors) : $book->authors,
                    'isbn_13' => $book->isbn_13,
                    'cover_url' => $book->cover_url,
                    'cover_thumbnail_url' => $book->getCoverThumbnailUrl(160),
                ];
            })->all();
        }
    }
}
