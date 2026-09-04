<?php

namespace App\Services;

use App\Models\Book;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Normalizer;

class AuthorCatalogueService
{
    protected const CACHE_KEY = 'books:authors:index:v1';

    protected const CACHE_TTL = 86400; // 24 h

    public function __construct(
        protected BookCatalogueService $catalogue
    ) {}

    /**
     * Index des auteurs du catalogue (agrégat du champ JSON `authors`).
     *
     * - `sort=top` : les auteurs les plus représentés (nb de titres décroissant) ;
     * - `letter=A..Z` (+ `all`) : navigation alphabétique paginée.
     *
     * Réponse : { data, total, total_authors, current_page, last_page, letters }
     */
    public function index(Request $request): array
    {
        $all = $this->aggregate();
        $totalAuthors = count($all);

        $letter = strtoupper(trim((string) $request->get('letter', 'all')));
        $sort = (string) $request->get('sort', 'alpha');
        $limit = min(max(1, $request->integer('limit', 24)), 48);
        $page = max(1, $request->integer('page', 1));

        $authors = $all;
        if ($sort === 'top') {
            usort($authors, fn (array $a, array $b) => $b['books_count'] <=> $a['books_count']);
        }

        if ($letter !== '' && $letter !== 'ALL') {
            $authors = array_values(array_filter(
                $authors,
                fn (array $a) => mb_strtoupper(mb_substr($a['name'], 0, 1, 'UTF-8'), 'UTF-8') === $letter
            ));
        }

        $total = count($authors);
        $lastPage = max(1, (int) ceil($total / $limit));
        $page = min($page, $lastPage);
        $slice = array_slice($authors, ($page - 1) * $limit, $limit);

        return [
            'data' => $slice,
            'total' => $total,
            'total_authors' => $totalAuthors,
            'current_page' => $page,
            'last_page' => $lastPage,
            'letters' => $this->lettersDistribution($all),
        ];
    }

    /**
     * Fiche auteur par slug : nom résolu depuis l'index agrégé + titres paginés.
     *
     * Réponse : { author: {name, slug, books_count, cover_url}, books, total, current_page, last_page }
     */
    public function show(string $slug, Request $request): ?array
    {
        $author = collect($this->aggregate())->first(fn (array $a) => $a['slug'] === $slug);

        if ($author === null) {
            return null;
        }

        $limit = min(max(1, $request->integer('limit', 24)), 48);
        $page = max(1, $request->integer('page', 1));

        $paginated = Book::query()
            ->whereJsonContains('authors', $author['name'])
            ->orderByDesc('created_at')
            ->orderBy('id')
            ->paginate($limit, ['*'], 'page', $page);

        $paginated->getCollection()
            ->load(['language', 'defaultCategory', 'defaultLevel'])
            ->loadCount(['listings as active_listings_count' => function ($q) {
                $q->where('status', 'published');
            }]);

        return [
            'author' => [
                'name' => $author['name'],
                'slug' => $author['slug'],
                'books_count' => $author['books_count'],
                'cover_url' => $author['cover_url'],
            ],
            'books' => collect($paginated->items())
                ->map(fn (Book $book) => $this->catalogue->formatBook($book))
                ->all(),
            'total' => $paginated->total(),
            'current_page' => $paginated->currentPage(),
            'last_page' => $paginated->lastPage(),
        ];
    }

    /**
     * Agrégat des auteurs (nom, slug, nb de titres, couverture d'exemple),
     * trié alphabétiquement et mis en cache 24 h.
     *
     * @return array<int, array{name: string, slug: string, books_count: int, cover_url: ?string}>
     */
    protected function aggregate(): array
    {
        // INCIDENT 03/09 soir (site injoignable) : ce scan complet des ~700k
        // livres (chunk 1000 → ~700 requêtes « limit 1000 offset N » de plus en
        // plus lourdes) était lancé EN PARALLÈLE par tous les workers php-fpm
        // tant que le cache 24 h n'était pas posé — or il ne l'est qu'à la FIN
        // du scan (10-20 min) → saturation MariaDB + php-fpm → API et site
        // injoignables (Google crawle les pages auteurs découvertes avant
        // l'allègement du sitemap, ce qui entretient la ruée).
        // Désactivation immédiate : index vide retourné (caché 24 h), AUCUNE
        // lecture de la table books. /books/auteurs affiche une liste vide,
        // les fiches auteurs renvoient 404 — acceptable pendant l'incident.
        // REMPLACEMENT À PRÉVOIR : agrégat SQL natif (JSON_TABLE) ou table
        // dénormalisée book_authors remplie à l'import — jamais de scan
        // applicatif complet sur une table de 700k lignes.
        return Cache::remember('books:authors:index:disabled:v1', self::CACHE_TTL, fn () => []);
    }

    /**
     * Distribution des auteurs par initiale (navigation A-Z du front).
     *
     * @return array<string, int>
     */
    protected function lettersDistribution(array $all): array
    {
        $letters = [];

        foreach ($all as $author) {
            $letter = mb_strtoupper(mb_substr($author['name'], 0, 1, 'UTF-8'), 'UTF-8');
            $letters[$letter] = ($letters[$letter] ?? 0) + 1;
        }

        ksort($letters, SORT_STRING);

        return $letters;
    }

    /**
     * Slug d'auteur, aligné sur l'algorithme du frontend
     * (NFD → suppression des diacritiques → non-alphanumériques en tirets),
     * afin que les URLs générées des deux côtés coïncident.
     */
    public static function slugify(string $name): string
    {
        $slug = mb_strtolower(trim($name), 'UTF-8');
        $decomposed = Normalizer::normalize($slug, Normalizer::FORM_D);

        if ($decomposed !== false) {
            $slug = $decomposed;
        }

        $slug = preg_replace('/\p{M}/u', '', $slug) ?? $slug;
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? $slug;

        return trim($slug, '-') ?: 'auteur';
    }
}
