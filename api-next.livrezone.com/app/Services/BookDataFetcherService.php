<?php

namespace App\Services;

use App\Models\Book;

class BookDataFetcherService
{
    /**
     * Cherche un livre par ISBN pour alimenter la création de listing.
     * 
     * Jusqu'à maintenant, notre seule source est la table books locale.
     * Cette méthode centralise la recherche pour permettre l'ajout facile
     * d'une logique de recherche par API externe (ex: Google Books) 
     * si le livre n'est pas trouvé en base.
     *
     * @param string $isbn
     * @return Book|null
     */
    public function findBookByIsbn(string $isbn): ?Book
    {
        // Recherche dans la base de données locale
        $book = Book::where('isbn_13', $isbn)->first();

        if (!$book) {
            // TODO: Ajouter la logique pour chercher par API externe 
            // si le livre n'est pas trouvé dans la table books.
            // S'il est trouvé via API, on pourra le créer dans la base locale et le retourner.
        }

        return $book;
    }
}
