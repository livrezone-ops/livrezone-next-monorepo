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
}
