<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Book;

class BookController extends Controller
{
    /**
     * Recherche d'un livre par son code ISBN
     */
    public function searchByIsbn(Request $request)
    {
        $isbn = $request->query('isbn');
        
        if (!$isbn) {
            return response()->json(['message' => 'Veuillez fournir un code ISBN'], 400);
        }

        // Nettoyage basique (retirer les tirets éventuels)
        $isbn = str_replace('-', '', $isbn);

        $book = Book::where('isbn_13', $isbn)->first();

        if (!$book) {
            return response()->json(['message' => 'Livre introuvable pour cet ISBN'], 404);
        }

        return response()->json(['book' => $book]);
    }

    /**
     * Recherche publique dans la table books (catalogue, pas uniquement les annonces).
     * Recherche sur : titre, ISBN, auteur, éditeur.
     */
    public function publicSearch(Request $request)
    {
        $query = Book::query();

        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('isbn_13', 'like', "%{$search}%")
                  ->orWhere('publisher', 'like', "%{$search}%")
                  // Les auteurs sont stockés en JSON : on compare la représentation texte.
                  ->orWhere('authors', 'like', "%{$search}%");
            });
        }

        $limit = $request->integer('limit', 24);
        $books = $query->orderBy('title')->paginate($limit);

        $books->getCollection()->transform(function ($book) {
            if ($book->title) {
                $book->setAppends(['cover_url']);
            }
            return $book;
        });

        return response()->json($books);
    }

    /**
     * Endpoint d'autocomplétion ultra-rapide (Typeahead) via Meilisearch
     */
    public function autocomplete(Request $request)
    {
        return response()->json(
            app(\App\Services\BookAutocompleteService::class)->suggest($request)
        );
    }
}
