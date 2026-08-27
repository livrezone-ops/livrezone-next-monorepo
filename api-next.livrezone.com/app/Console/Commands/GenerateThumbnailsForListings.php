<?php

namespace App\Console\Commands;

use App\Models\Listing;
use App\Services\ThumbnailService;
use Illuminate\Console\Command;

class GenerateThumbnailsForListings extends Command
{
    protected $signature = 'covers:generate-thumbnails
        {--force : Régénérer les miniatures même si elles existent déjà}';

    protected $description = 'Génère les miniatures (160/320) des couvertures utilisées par les annonces (génération paresseuse : uniquement les couvertures sollicitées).';

    public function handle(): void
    {
        $force = (bool) $this->option('force');

        $query = Listing::query()
            ->whereNotNull('cover_path')
            ->where('cover_path', '!=', '');

        $total = (clone $query)->count();

        if ($total === 0) {
            $this->info('Aucune annonce à traiter.');

            return;
        }

        $this->info("{$total} annonces trouvées. Début de la génération...");
        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $query->select('id', 'cover_path')
            ->chunkById(500, function ($listings) use ($force, $bar) {
                foreach ($listings as $listing) {
                    ThumbnailService::ensureThumbnailsExist($listing->cover_path, $force);
                    $bar->advance();
                }
            });

        $bar->finish();
        $this->newLine(2);
        $this->info('Terminé ! Les miniatures manquantes ont été générées.');
    }
}
