<?php

namespace App\Services;

use App\Models\Book;
use Illuminate\Http\Request;

class BookAutocompleteService
{
    /**
     * Recherche instantanée (typeahead) de livres via Meilisearch avec vignettes.
     *
     * Exclusivement Meilisearch (règle architecture 03/09) : AUCUN fallback SQL
     * — un `LIKE '%…%'` sur 700k lignes est un scan complet de la table et
     * peut saturer MariaDB (leçon incident). Si Meilisearch est indisponible,
     * on renvoie simplement une liste vide.
     */
    public function suggest(Request $request): array
    {
        $query = trim((string) $request->get('q', ''));
        $limit = min(max(1, $request->integer('limit', 6)), 8);

        if (empty($query)) {
            return [];
        }

        try {
            $books = Book::search($query)->take($limit)->get();
            $books->load(['defaultCategory.parent']);

            return $books->map(fn (Book $book) => $this->formatBook($book))->all();
        } catch (\Throwable) {
            // Meilisearch indisponible → aucune suggestion (pas de fallback SQL).
            return [];
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
