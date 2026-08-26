<?php

namespace App\Console\Commands;

use App\Models\Listing;
use Illuminate\Console\Command;
use Meilisearch\Client;

class ConfigureListingSearch extends Command
{
    protected $signature = 'listings:configure-search';

    protected $description = 'Configure les attributs filterable/sortable de l\'index Meilisearch "listings".';

    public function handle(): int
    {
        $host = config('scout.meilisearch.host', env('MEILISEARCH_HOST'));
        $key = config('scout.meilisearch.key', env('MEILISEARCH_KEY'));

        if (empty($host)) {
            $this->error('Meilisearch non configuré (MEILISEARCH_HOST manquant).');

            return 1;
        }

        $client = new Client($host, $key);
        $index = $client->index((new Listing)->searchableAs());

        $index->updateFilterableAttributes([
            'category_id',
            'language_id',
            'level_id',
            'book_condition',
            'status',
            'user_id',
            'subject_id',
            'city_id',
        ]);

        $index->updateSortableAttributes([
            'created_at',
            'published_at',
            'price',
            'discount_price',
            'id',
        ]);

        $this->info('Index Meilisearch « '.(new Listing)->searchableAs().' » : filterable + sortable appliqués.');
        $this->info('Ensuite, réindexez : php artisan scout:import "App\Models\Listing"');

        return 0;
    }
}
