<?php

namespace App\Services;

use App\Models\Book;
use Illuminate\Http\Request;

class BookAutocompleteService
{
    /**
     * Recherche instantanée (typeahead) de livres via Meilisearch.
     */
    public function suggest(Request $request): array
    {
        $query = $request->get('q', '');
        $limit = $request->integer('limit', 5);

        if (empty($query)) {
            return [];
        }

        // Utilisation de Laravel Scout (Meilisearch)
        // La méthode raw() retourne directement le JSON de Meilisearch, ce qui est le plus rapide.
        // Mais pour simplifier l'accès à cover_url, on peut retourner get() et transformer.
        // Si Meilisearch contient déjà cover_url (cf toSearchableArray dans Book.php),
        // alors la réponse raw est parfaite et ultra-rapide sans interroger MariaDB.
        
        $results = Book::search($query)->take($limit)->raw();

        if (isset($results['hits'])) {
            return $results['hits'];
        }

        return [];
    }
}
