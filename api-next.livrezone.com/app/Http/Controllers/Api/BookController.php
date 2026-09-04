<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Services\AuthorCatalogueService;
use App\Services\BookAutocompleteService;
use App\Services\BookCatalogueService;
use App\Services\BookDetailService;
use Illuminate\Http\Request;

class BookController extends Controller
{
    /**
     * Recherche d'un livre par son code ISBN
     */
    public function searchByIsbn(Request $request)
    {
        $isbn = $request->query('isbn');

        if (! $isbn) {
            return response()->json(['message' => 'Veuillez fournir un code ISBN'], 400);
        }

        // Nettoyage basique (retirer les tirets éventuels)
        $isbn = str_replace('-', '', $isbn);

        $book = Book::where('isbn_13', $isbn)->first();

        if (! $book) {
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
            app(BookCatalogueService::class)->search($request)
        );
    }

    /**
     * Index des auteurs du catalogue (agrégat du champ JSON authors).
     * Paramètres : ?letter=A..Z|all, ?sort=top|alpha, ?page, ?limit (max 48).
     */
    public function authors(Request $request)
    {
        return response()->json(
            app(AuthorCatalogueService::class)->index($request)
        );
    }

    /**
     * Fiche auteur par slug + ses titres du catalogue.
     */
    public function authorShow(string $slug, Request $request)
    {
        $result = app(AuthorCatalogueService::class)->show($slug, $request);

        if ($result === null) {
            return response()->json(['message' => 'Auteur introuvable'], 404);
        }

        return response()->json($result);
    }

    /**
     * Endpoint d'autocomplétion ultra-rapide (Typeahead) via Meilisearch
     */
    public function autocomplete(Request $request)
    {
        return response()->json(
            app(BookAutocompleteService::class)->suggest($request)
        );
    }

    /**
     * Récupère un livre par son ID, son ISBN ou son Titre
     */
    public function show($identifier)
    {
        $book = app(BookDetailService::class)->getByIdentifier((string) $identifier);

        if (! $book) {
            return response()->json(['message' => 'Livre introuvable'], 404);
        }

        return response()->json(['book' => $book]);
    }
}
