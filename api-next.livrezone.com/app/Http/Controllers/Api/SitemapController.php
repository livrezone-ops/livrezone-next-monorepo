<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\Listing;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Endpoints de génération des sitemaps XML côté frontend (SEO catalogue, 06/09).
 * Remplace l'ancien ListingController::sitemap() non borné (audit CRITIQUE #2) :
 * tout est paginé par intervalles d'id, léger (colonnes minimales) et caché —
 * consommé par le serveur Next, jamais par les visiteurs directement.
 */
class SitemapController extends Controller
{
    // Limite Google : 50 000 URLs ou 50 Mo par fichier de sitemap.
    private const BOOK_CHUNK_SIZE = 50000;

    private const LISTINGS_PER_PAGE = 5000;

    private const PUBLISHERS_PER_PAGE = 100;

    /**
     * Bornes des chunks livres : total + intervalles d'id stables (pk indexée),
     * calculés une fois puis cachés 24 h.
     */
    public function booksMeta()
    {
        return response()->json($this->cachedBooksMeta());
    }

    private function cachedBooksMeta(): array
    {
        return Cache::remember('sitemap:books:meta', 86400, function () {
            $total = Book::count();
            $chunks = [];

            if ($total > 0) {
                $boundaries = [(int) Book::min('id')];
                // Bornes par OFFSET sur la pk : ~14 scans index-only pour 697k lignes.
                for ($offset = self::BOOK_CHUNK_SIZE; $offset < $total; $offset += self::BOOK_CHUNK_SIZE) {
                    $id = Book::query()->orderBy('id')->skip($offset)->value('id');
                    if ($id === null) {
                        break;
                    }
                    $boundaries[] = (int) $id;
                }

                for ($i = 0; $i < count($boundaries); $i++) {
                    $chunks[] = [
                        'chunk' => $i + 1,
                        'min_id' => $boundaries[$i],
                        'max_id' => ($boundaries[$i + 1] ?? (int) Book::max('id') + 1) - 1,
                    ];
                }
            }

            return [
                'total' => $total,
                'chunk_size' => self::BOOK_CHUNK_SIZE,
                'chunks' => $chunks,
            ];
        });
    }

    /**
     * Un chunk de livres (colonnes minimales pour construire les URLs front).
     * Validation par appartenance aux bornes de /sitemap/books/meta : les ids
     * de la table sont troués (suppressions), l'empan d'un chunk légitime peut
     * dépasser la taille du chunk — seul le couple (min_id, max_id) de la meta
     * fait foi (anti-extraction de la table entière).
     */
    public function books(Request $request)
    {
        $minId = (int) $request->query('min_id', 0);
        $maxId = (int) $request->query('max_id', 0);

        $meta = $this->cachedBooksMeta();
        $isKnownChunk = collect($meta['chunks'] ?? [])
            ->contains(fn ($chunk) => $chunk['min_id'] === $minId && $chunk['max_id'] === $maxId);

        if (! $isKnownChunk) {
            return response()->json([
                'message' => 'Chunk inconnu : récupérez les bornes valides sur /sitemap/books/meta.',
            ], 422);
        }

        $rows = [];
        Book::query()
            ->whereBetween('id', [$minId, $maxId])
            ->select('id', 'isbn_13', 'title', 'updated_at')
            ->orderBy('id')
            ->chunk(2000, function ($chunk) use (&$rows) {
                foreach ($chunk as $book) {
                    $rows[] = [
                        'id' => $book->id,
                        'isbn' => $book->isbn_13,
                        'title' => $book->title,
                        'updated_at' => $book->updated_at?->toIso8601String(),
                    ];
                }
            });

        return response()->json(['data' => $rows]);
    }

    public function listingsMeta()
    {
        return response()->json(Cache::remember('sitemap:listings:meta', 3600, function () {
            $total = Listing::query()->where('status', 'published')->count();

            return [
                'total' => $total,
                'per_page' => self::LISTINGS_PER_PAGE,
                'pages' => (int) max(1, ceil($total / self::LISTINGS_PER_PAGE)),
            ];
        }));
    }

    /**
     * Annonces publiées d'une page donnée (nickname requis pour l'URL front).
     */
    public function listings(Request $request)
    {
        $page = max(1, (int) $request->query('page', 1));

        $rows = Listing::query()
            ->where('status', 'published')
            ->select('id', 'title', 'isbn_13', 'user_id', 'updated_at')
            ->with('user.profile:id,user_id,nickname')
            ->orderBy('id')
            ->forPage($page, self::LISTINGS_PER_PAGE)
            ->get()
            ->map(fn (Listing $listing) => [
                'id' => $listing->id,
                'isbn' => $listing->isbn_13,
                'title' => $listing->title,
                'nickname' => $listing->user?->profile?->nickname ?? ('utilisateur-'.$listing->user_id),
                'updated_at' => $listing->updated_at?->toIso8601String(),
            ])
            ->values();

        return response()->json(['data' => $rows]);
    }

    /**
     * Annuaire des éditeurs (hubs SEO) : liste complète cachée 24 h, servie
     * paginée. Le slug est calculé côté API (Str::slug) pour garantir que le
     * front, le sitemap et la résolution /publishers/{slug} concordent.
     */
    public function publishers(Request $request)
    {
        $list = $this->cachedPublishers();
        $page = max(1, (int) $request->query('page', 1));
        // per_page élevé autorisé (jusqu'à 50k = 1 fichier sitemap) : données
        // bibliographiques publiques, consommées par le serveur Next.
        $perPage = min(50000, max(1, (int) $request->query('per_page', self::PUBLISHERS_PER_PAGE)));

        return response()->json([
            'data' => $list->forPage($page, $perPage)->values(),
            'total' => $list->count(),
            'current_page' => $page,
            'last_page' => (int) max(1, ceil($list->count() / $perPage)),
        ]);
    }

    /**
     * Résolution slug → éditeur (nom + volume) pour la page hub front.
     */
    public function publisher(string $slug)
    {
        $found = $this->cachedPublishers()->firstWhere('slug', $slug);

        if ($found === null) {
            return response()->json(['message' => 'Éditeur introuvable.'], 404);
        }

        return response()->json(['publisher' => $found]);
    }

    private function cachedPublishers()
    {
        // Tableau PHP pur dans le cache (jamais une Collection) : en production,
        // désérialiser un objet cache => « incomplete object » (constat 21:24).
        $list = Cache::remember('sitemap:publishers', 86400, function () {
            return Book::query()
                ->whereNotNull('publisher')
                ->selectRaw('publisher, COUNT(*) as books_count')
                ->groupBy('publisher')
                ->orderBy('publisher')
                ->get()
                ->map(fn ($row) => [
                    'name' => $row->publisher,
                    'slug' => Str::slug((string) $row->publisher),
                    'books_count' => (int) $row->books_count,
                ])
                ->values()
                ->all();
        });

        return collect($list);
    }
}
