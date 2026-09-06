<?php

namespace App\Console\Commands;

use App\Models\Book;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Meilisearch\Client;

class ConfigureBookSearch extends Command
{
    protected $signature = 'books:configure-search';

    protected $description = 'Configure les attributs filterable/sortable de l\'index Meilisearch "books" (requis pour filtrer par catégorie/langue/niveau sans scanner MySQL).';

    public function handle(): int
    {
        $host = config('scout.meilisearch.host', env('MEILISEARCH_HOST'));
        $key = config('scout.meilisearch.key', env('MEILISEARCH_KEY'));

        if (empty($host)) {
            $this->error('Meilisearch non configuré (MEILISEARCH_HOST manquant).');

            return 1;
        }

        $client = new Client($host, $key);
        $index = $client->index((new Book)->searchableAs());

        $index->updateFilterableAttributes([
            'default_category_id',
            'language_id',
            'default_level_id',
            'default_subject_id',
            'isbn_13',
            'authors_list',
            // Hubs éditeurs (SEO 06/09) : /books?publisher=… sur les 697k docs.
            'publisher',
            // Livres similaires (SEO 06/09) : filtre « NOT id = courant ».
            'id',
        ]);

        $index->updateSortableAttributes([
            'created_at',
            'id',
        ]);

        // Cap de pagination relevé (défaut Meili = 1000) : sans lui, toute
        // requête matchant > 1000 livres renvoyait « total: 1000 » au front
        // (constaté 06/09 avec search=a → 693 691 réels). Le SDK embarqué
        // n'expose pas updatePaginationSettings() → PATCH HTTP direct, qui ne
        // touche QUE ce réglage (updateSettings() ferait un remplacement global).
        Http::withHeaders(['Authorization' => 'Bearer '.$key])
            ->patch(rtrim($host, '/').'/indexes/'.(new Book)->searchableAs().'/settings/pagination', [
                'maxTotalHits' => 1000000,
            ]);

        $this->info('Index Meilisearch « '.(new Book)->searchableAs().' » : filterable + sortable + maxTotalHits appliqués.');
        $this->info('Ensuite, réindexez : php artisan scout:import "App\Models\Book"');

        return 0;
    }
}
