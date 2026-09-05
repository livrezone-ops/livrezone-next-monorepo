<?php
/*
 * Éphémère (04/09/2026) : peuple `authors_list` dans l'index Meilisearch "books"
 * par mises à jour partielles (addDocuments = merge des champs depuis Meilisearch 1.1),
 * sans réindexation complète des ~700k livres.
 * À SUPPRIMER après exécution.
 */
require '/var/www/html/api-next.livrezone.com/vendor/autoload.php';
$app = require '/var/www/html/api-next.livrezone.com/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Book;
use Meilisearch\Client;

$host = config('scout.meilisearch.host', env('MEILISEARCH_HOST'));
$key = config('scout.meilisearch.key', env('MEILISEARCH_KEY'));

$client = new Client($host, $key);
$index = $client->index((new Book)->searchableAs());

$total = 0;
$lastId = 0;

do {
    $books = Book::query()
        ->select('id', 'authors')
        ->where('id', '>', $lastId)
        ->orderBy('id')
        ->limit(5000)
        ->get();

    if ($books->isEmpty()) {
        break;
    }

    $docs = [];
    foreach ($books as $book) {
        $docs[] = [
            'id' => (int) $book->id,
            'authors_list' => array_values(array_filter((array) ($book->authors ?? []), fn ($a) => trim((string) $a) !== '')),
        ];
        $lastId = $book->id;
    }

    // Mise à jour partielle : seuls id + authors_list sont fusionnés dans les docs existants.
    $index->addDocuments($docs);
    $total += count($docs);
    echo "Traité jusqu'à id={$lastId} (total {$total})" . PHP_EOL;
} while (true);

echo "TERMINE : {$total} documents envoyés en mise à jour partielle." . PHP_EOL;
