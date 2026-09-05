<?php

namespace App\Console\Commands;

use App\Models\Book;
use Illuminate\Console\Command;
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
            'isbn_13',
            'authors_list',
        ]);

        $index->updateSortableAttributes([
            'created_at',
            'id',
        ]);

        $this->info('Index Meilisearch « '.(new Book)->searchableAs().' » : filterable + sortable appliqués.');
        $this->info('Ensuite, réindexez : php artisan scout:import "App\Models\Book"');

        return 0;
    }
}
