<?php

namespace App\Console\Commands;

use App\Models\Profile;
use App\Services\ProfileSearchService;
use Illuminate\Console\Command;
use Meilisearch\Client;

class ConfigureProfileSearch extends Command
{
    protected $signature = 'profiles:configure-search';

    protected $description = 'Configure l\'index Meilisearch "profiles" (moteur de recherche par défaut) et recalcule le counter cache des publications.';

    public function handle(): int
    {
        $host = config('scout.meilisearch.host', env('MEILISEARCH_HOST'));
        $key = config('scout.meilisearch.key', env('MEILISEARCH_KEY'));

        if (empty($host)) {
            $this->error('Meilisearch non configuré (MEILISEARCH_HOST manquant).');

            return 1;
        }

        $client = new Client($host, $key);
        $index = $client->index((new Profile)->searchableAs());

        $index->updateSearchableAttributes(['nickname']);
        $index->updateFilterableAttributes([
            'city_id',
            'profile_type',
            'listing_count',
            'profile_book_conditions',
        ]);
        $index->updateSortableAttributes([
            'subscription_rank',
            'rating_average',
            'listing_count',
            'id',
        ]);

        $this->info('Index Meilisearch « '.(new Profile)->searchableAs().' » configuré (recherche stricte sur nickname).');

        // Recalcule le counter cache sans synchroniser à chaque save (évite N écritures réseau).
        // Backfill : tout profil n'ayant pas déclaré son activité principale reçoit "occas".
        $service = app(ProfileSearchService::class);
        $count = 0;

        Profile::withoutSyncingToSearch(function () use ($service, &$count) {
            Profile::query()
                ->whereNull('profile_book_conditions')
                ->update(['profile_book_conditions' => 'occas']);

            Profile::query()->chunkById(200, function ($profiles) use ($service, &$count) {
                foreach ($profiles as $profile) {
                    $service->syncStats($profile);
                    $count++;
                }
            });
        });

        $this->info("Counter cache recalculé pour {$count} profil(s).");
        $this->info('Ensuite, réindexez : php artisan scout:import "App\Models\Profile"');

        return 0;
    }
}
