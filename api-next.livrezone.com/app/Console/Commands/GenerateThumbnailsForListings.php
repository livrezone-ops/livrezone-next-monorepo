<?php

namespace App\Console\Commands;

use App\Models\Listing;
use App\Models\Order;
use App\Services\ThumbnailService;
use Illuminate\Console\Command;

class GenerateThumbnailsForListings extends Command
{
    protected $signature = 'covers:generate-thumbnails
        {--force : Régénérer les miniatures même si elles existent déjà}';

    protected $description = 'Génère les miniatures (160/320) des couvertures utilisées par les annonces ET les demandes (génération paresseuse : uniquement les couvertures sollicitées).';

    public function handle(): void
    {
        $force = (bool) $this->option('force');

        $this->process(Listing::query()->whereNotNull('cover_path')->where('cover_path', '!=', ''), 'annonces', $force);
        $this->process(Order::query()->whereNotNull('cover_path')->where('cover_path', '!=', ''), 'demandes', $force);

        $this->newLine();
        $this->info('Terminé ! Les miniatures manquantes ont été générées.');
    }

    private function process($query, string $label, bool $force): void
    {
        $total = (clone $query)->count();

        if ($total === 0) {
            $this->line("[$label] Aucune ligne à traiter.");

            return;
        }

        $this->info("[$label] {$total} lignes trouvées. Génération...");
        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $query->select('id', 'cover_path')
            ->chunkById(500, function ($rows) use ($force, $bar) {
                foreach ($rows as $row) {
                    ThumbnailService::ensureThumbnailsExist($row->cover_path, $force);
                    $bar->advance();
                }
            });

        $bar->finish();
        $this->newLine();
    }
}
