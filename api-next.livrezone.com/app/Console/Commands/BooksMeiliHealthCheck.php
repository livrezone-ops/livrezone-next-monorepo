<?php

namespace App\Console\Commands;

use App\Models\Book;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Meilisearch\Client;

/**
 * Garde-fou anti-récidive : l'index Meilisearch `books` a été DEUX FOIS écrasé
 * par des documents partiels {id, authors_list} par des écritures hors dépôt
 * (05/09 puis 07/09, cf. .agents/incident-index-books-20260906.md). Les settings
 * (filterable) restent bons, mais filtres/facettes/tri meurent silencieusement :
 * l'API réhydrate par PK donc la recherche « a l'air » de marcher.
 *
 * Compare le fieldDistribution de l'index aux 12 champs attendus du
 * toSearchableArray et le nombre de documents au compteur MySQL. Ne log QUE en
 * cas d'anomalie (convention QueueHealthCheck). Planifié chaque jour à 03:45,
 * après books:configure-search (03:40).
 */
class BooksMeiliHealthCheck extends Command
{
    protected $signature = 'books:check-meili';

    protected $description = 'Vérifie que l’index Meilisearch « books » contient bien tous les champs du toSearchableArray (alerte critique sinon).';

    public function handle(): int
    {
        $host = config('scout.meilisearch.host', env('MEILISEARCH_HOST'));
        $key = config('scout.meilisearch.key', env('MEILISEARCH_KEY'));

        if (empty($host)) {
            $this->error('Meilisearch non configuré (MEILISEARCH_HOST manquant).');

            return self::FAILURE;
        }

        $client = new Client($host, $key);
        $indexUid = (new Book)->searchableAs();

        try {
            $stats = $client->index($indexUid)->stats();
        } catch (\Throwable $e) {
            $this->error("Index Meilisearch « {$indexUid} » injoignable : {$e->getMessage()}");
            Log::critical("Meilisearch books : index « {$indexUid} » injoignable", ['error' => $e->getMessage()]);

            return self::FAILURE;
        }

        $fieldDistribution = $stats['fieldDistribution'] ?? [];
        $docs = (int) ($stats['numberOfDocuments'] ?? 0);

        $expected = [
            'id', 'title', 'authors', 'authors_list', 'isbn_13', 'publisher',
            'cover_url', 'default_category_id', 'language_id', 'default_level_id',
            'default_subject_id', 'created_at',
        ];
        $missing = array_values(array_filter(
            $expected,
            fn (string $field) => ($fieldDistribution[$field] ?? 0) < $docs || $docs === 0
        ));

        $booksCount = (int) Book::count();
        $drift = abs($docs - $booksCount);

        if ($missing === [] && $drift <= 100) {
            return self::SUCCESS;
        }

        $issues = [];
        if ($missing !== []) {
            $issues[] = 'Champs absents/appauvris de l’index : '.implode(', ', $missing)
                .' — documents partiels (écriture hors Scout ?). Réparer : drainer la queue '
                .'(app:queue-health) PUIS php artisan books:import-meili --chunk=5000.';
        }
        if ($drift > 100) {
            $issues[] = "Dérive de comptage : {$docs} docs Meili vs {$booksCount} livres MySQL (écart {$drift}).";
        }

        foreach ($issues as $issue) {
            $this->error($issue);
            Log::critical('Meilisearch books en anomalie : '.$issue, [
                'docs' => $docs,
                'books_mysql' => $booksCount,
                'fields_found' => array_keys($fieldDistribution),
            ]);
        }

        return self::FAILURE;
    }
}
