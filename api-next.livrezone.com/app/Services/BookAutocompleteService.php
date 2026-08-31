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
            $books->load(['defaultCategory.parent']);

            return $books->map(fn (Book $book) => $this->formatBook($book))->all();
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

            $books->load(['defaultCategory.parent']);

            return $books->map(fn (Book $book) => $this->formatBook($book))->all();
        }
    }

    /**
     * Représentation compacte d'un livre : vignette, ISBN et chemin de
     * catégorie (parent > enfant) pour l'affichage dans le form de demande.
     */
    private function formatBook(Book $book): array
    {
        $category = $book->defaultCategory;

        return [
            'id' => $book->id,
            'title' => $book->title,
            'authors' => is_array($book->authors) ? implode(', ', $book->authors) : $book->authors,
            'isbn_13' => $book->isbn_13,
            'cover_url' => $book->cover_url,
            'cover_thumbnail_url' => $book->getCoverThumbnailUrl(160),
            'default_category_id' => $category?->id,
            'category_parent' => $category?->parent?->name_fr,
            'category_child' => $category?->name_fr,
        ];
    }
}
