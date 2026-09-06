<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Services\BookAutocompleteService;
use App\Services\BookCatalogueService;
use App\Services\BookDetailService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

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

    /**
     * Livres similaires (maillage interne SEO, 06/09) : même rayon via
     * Meilisearch, hors fiche courante, complété par les fiches récentes si le
     * rayon est trop petit. Caché 6 h — appelé sur chaque fiche livre.
     */
    public function related(Book $book)
    {
        // Clé v2 + tableau PHP pur dans le cache (jamais une Collection/Eloquent) :
        // les entrées v1 sérialisées ressortent en « incomplete object » en prod.
        $books = Cache::remember('book:related2:'.$book->id, 21600, function () use ($book) {
            $filter = $book->default_category_id
                ? 'default_category_id = '.$book->default_category_id.' AND NOT id = '.$book->id
                : 'NOT id = '.$book->id;

            try {
                $ids = Book::search('', function ($meilisearch, $query) use ($filter) {
                    return $meilisearch->search($query, [
                        'filter' => $filter,
                        'limit' => 8,
                        'attributesToRetrieve' => ['id'],
                    ]);
                })->keys();
            } catch (\Throwable $e) {
                report($e);
                $ids = collect();
            }

            // Complément avec des fiches récentes si le rayon est trop petit.
            if ($ids->count() < 8) {
                $extra = Book::query()
                    ->whereNot('id', $book->id)
                    ->when($book->default_category_id, fn ($q) => $q->where('default_category_id', $book->default_category_id))
                    ->whereNotNull('cover_path')
                    ->orderByDesc('updated_at')
                    ->limit(8 - $ids->count())
                    ->pluck('id');
                $ids = $ids->merge($extra)->unique()->take(8);
            }

            if ($ids->isEmpty()) {
                return [];
            }

            return Book::query()
                ->whereIn('id', $ids)
                ->select('id', 'isbn_13', 'title', 'authors', 'publisher', 'cover_path', 'cover_source_url')
                ->get()
                ->each(fn ($b) => $b->setAppends(['cover_url', 'cover_thumbnail_url']))
                // Ordre du résultat Meili (pertinence), pas celui du whereIn MySQL.
                ->sortBy(fn ($b) => array_search($b->id, $ids->all(), true))
                ->values()
                // Payload carte final en tableau pur — caché tel quel.
                ->map(fn ($b) => [
                    'id' => $b->id,
                    'isbn_13' => $b->isbn_13,
                    'title' => $b->title,
                    'authors' => $b->authors,
                    'publisher' => $b->publisher,
                    'cover_url' => $b->cover_url,
                    'cover_thumbnail_url' => $b->cover_thumbnail_url,
                ])
                ->all();
        });

        return response()->json(['data' => $books]);
    }
}
