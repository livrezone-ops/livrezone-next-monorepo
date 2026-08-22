<?php

namespace App\Services;

use App\Models\Book;
use Illuminate\Http\Request;

class BookCatalogueService
{
    /**
     * Recherche publique sécurisée contre le scraping massif.
     */
    public function search(Request $request)
    {
        $limit = $request->integer('limit', 24);
        $page = $request->integer('page', 1);

        // HARD CAP : Bloquer les requêtes au-delà de la page 20
        // Cela empêche l'aspiration totale de la BDD via pagination profonde.
        if ($page > 20) {
            // Renvoie une collection vide formatée comme une pagination
            return new \Illuminate\Pagination\LengthAwarePaginator([], 0, $limit, $page);
        }

        if ($request->filled('search')) {
            $search = $request->get('search');
            // Recherche ultra-rapide via Meilisearch
            $books = Book::search($search)->paginate($limit);
        } else {
            // S'il n'y a pas de recherche texte, on renvoie les derniers livres
            $books = Book::latest('id')->paginate($limit);
        }

        $books->getCollection()->transform(function ($book) {
            if ($book->title) {
                // On inclut les deux pour le frontend : la miniature pour la perf
                // et l'original en fallback (assuré par le proxy web.php)
                $book->setAppends(['cover_url', 'cover_thumbnail_url']);
            }
            return $book;
        });

        return $books;
    }
}
