<?php

namespace App\Console\Commands;

use App\Models\Order;
use Illuminate\Console\Command;
use Meilisearch\Client;

class ConfigureDemandeSearch extends Command
{
    protected $signature = 'demandes:configure-search';
    protected $description = 'Configure les attributs filterable/sortable de l\'index Meilisearch "orders" (source unique du catalogue des demandes).';

    public function handle(): int
    {
        $host = config('scout.meilisearch.host', env('MEILISEARCH_HOST'));
        $key = config('scout.meilisearch.key', env('MEILISEARCH_KEY'));

        if (empty($host)) {
            $this->error('Meilisearch non configuré (MEILISEARCH_HOST manquant).');
            return 1;
        }

        $client = new Client($host, $key);
        $index = $client->index((new Order)->searchableAs());

        $index->updateFilterableAttributes([
            'status',
            'category_id',
            'city_id',
            'language_id',
        ]);

        $index->updateSortableAttributes([
            'published_at',
            'id',
        ]);

        $this->info('Index Meilisearch « ' . (new Order)->searchableAs() . ' » : filterable + sortable appliqués.');
        $this->info('Ensuite, réindexez : php artisan scout:import "App\Models\Order"');

        return 0;
    }
}
