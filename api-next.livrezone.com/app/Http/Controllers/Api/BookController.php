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
     * Recherche dans la table books (catalogue).
     * Sécurisé via BookCatalogueService (Hard cap pagination).
     */
    public function publicSearch(Request $request)
    {
        return response()->json(
            app(\App\Services\BookCatalogueService::class)->search($request)
        );
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

    /**
     * Récupère un livre par son ID, son ISBN ou son Titre
     */
    public function show($identifier)
    {
        $book = Book::query()
            ->where('id', $identifier)
            ->orWhere('isbn_13', $identifier)
            ->orWhere('title', $identifier)
            ->first();

        if (!$book) {
            return response()->json(['message' => 'Livre introuvable'], 404);
        }

        $book->setAppends(['cover_url', 'cover_thumbnail_url']);

        return response()->json(['book' => $book]);
    }
}
