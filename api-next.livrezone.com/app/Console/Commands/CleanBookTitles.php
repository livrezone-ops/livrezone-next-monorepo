<?php

namespace App\Console\Commands;

use App\Models\Book;
use App\Services\BookTitleCleanerService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class CleanBookTitles extends Command
{
    protected $signature = 'books:clean-titles 
                            {--all : Scanne l\'intégralité des 697 172 livres de la base sans filtre}
                            {--listings : Nettoie également les annonces de la table listings}
                            {--dry-run : Exécute en mode simulation sans modifier la base}
                            {--limit=50 : Nombre maximum de livres à traiter ou afficher (0 pour tout)}
                            {--sync-meili : Pousse également les livres modifiés vers Meilisearch}
                            {--chunk=500 : Taille des lots}';

    protected $description = 'Nettoie les titres pollués dans la table books (suppression parasites BNF/auteurs, conservation éditions, normalisation, sync Meilisearch)';

    public function handle(BookTitleCleanerService $cleaner)
    {
        DB::disableQueryLog();
        ini_set('memory_limit', '2048M');

        $isAll = $this->option('all');
        $isDryRun = $this->option('dry-run');
        $limit = (int) $this->option('limit');
        $syncMeili = $this->option('sync-meili');
        $chunkSize = (int) $this->option('chunk');

        $this->info("==================================================");
        $this->info("        NETTOYAGE DES TITRES - LIVREZONE          ");
        $this->info("==================================================");
        $this->info("Périmètre : " . ($isAll ? "INTÉGRALITÉ DU CATALOGUE (697 172 livres)" : "REQUÊTE CIBLÉE"));
        $this->info("Mode : " . ($isDryRun ? "SIMULATION (DRY-RUN - Aucune modification)" : "MODIFICATION RÉELLE"));
        $this->info("Conserver les éditions : OUI");
        $this->info("Recalculer normalized_title : OUI");
        $this->info("Sync Meilisearch : " . ($syncMeili ? "OUI" : "NON"));
        $this->newLine();

        if ($syncMeili && ! $isDryRun) {
            config(['scout.queue' => false]);
        }

        if ($isAll) {
            $query = Book::query();
        } else {
            // Requête ciblée élargie incluant les mentions d'éditions, crochets et séparateurs courts
            $query = Book::where(function ($q) {
                $q->where('title', 'LIKE', '%,...%')
                  ->orWhere('title', 'LIKE', '%[Texte imprimé]%')
                  ->orWhere('title', 'LIKE', '%[Reproduction en fac-similé]%')
                  ->orWhere('title', 'LIKE', '%[Autocollant%')
                  ->orWhere('title', 'LIKE', '%[par]%')
                  ->orWhere('title', 'LIKE', '%[et al%')
                  ->orWhere('title', 'LIKE', '% ; %')
                  ->orWhere('title', 'LIKE', '% / %')
                  ->orWhere('title', 'LIKE', '%ouvrage coordonné par%')
                  ->orWhere('title', 'LIKE', '%collaboration de%')
                  ->orWhere('title', 'LIKE', '%direction de%')
                  ->orWhere('title', 'LIKE', '%traduit par%')
                  ->orWhere('title', 'LIKE', '%illustré par%')
                  ->orWhere('title', 'LIKE', '% éd.%)%')
                  ->orWhereRaw('CHAR_LENGTH(title) > 90');
            });
        }

        $totalTargeted = (clone $query)->count();
        $this->info("Livres ciblés pour audit de nettoyage : " . number_format($totalTargeted, 0, ',', ' '));

        $processTotal = ($limit > 0) ? min($limit, $totalTargeted) : $totalTargeted;
        $this->info("Nombre de livres à analyser : " . number_format($processTotal, 0, ',', ' '));
        $this->newLine();

        $bar = $this->output->createProgressBar($processTotal);
        $bar->start();

        $host = config('scout.meilisearch.host', env('MEILISEARCH_HOST'));
        $key = config('scout.meilisearch.key', env('MEILISEARCH_KEY'));

        $totalScanned = 0;
        $totalModified = 0;
        $examples = [];

        // Traitement par lots (chunkById) pour préserver la mémoire PHP
        $query->chunkById($chunkSize, function ($books) use (
            $cleaner,
            $isDryRun,
            $syncMeili,
            $limit,
            $host,
            $key,
            $bar,
            &$totalScanned,
            &$totalModified,
            &$examples
        ) {
            $chunkModifiedIds = [];

            foreach ($books as $book) {
                if ($limit > 0 && $totalScanned >= $limit) {
                    return false; // Arrêter le traitement
                }

                $totalScanned++;
                $bar->advance();

                $originalTitle = $book->title;
                $cleanedTitle = $cleaner->clean($originalTitle, $book->authors);

                if ($cleanedTitle !== $originalTitle) {
                    $totalModified++;
                    $newNormalized = $cleaner->normalize($cleanedTitle);

                    if (count($examples) < 25) {
                        $examples[] = [
                            'id' => $book->id,
                            'isbn_13' => $book->isbn_13,
                            'avant' => $originalTitle,
                            'apres' => $cleanedTitle,
                            'auteurs' => is_array($book->authors) ? implode(', ', $book->authors) : (string) $book->authors,
                        ];
                    }

                    if (! $isDryRun) {
                        DB::table('books')->where('id', $book->id)->update([
                            'title' => mb_substr($cleanedTitle, 0, 255),
                            'normalized_title' => $newNormalized,
                            'updated_at' => now(),
                        ]);
                        $chunkModifiedIds[] = $book->id;
                    }
                }
            }

            // Sync Meilisearch immédiat par lot pour fluidifier les requêtes
            if (! $isDryRun && $syncMeili && ! empty($chunkModifiedIds)) {
                $modifiedBooks = Book::whereIn('id', $chunkModifiedIds)->get();
                try {
                    $modifiedBooks->searchable();
                } catch (\Exception $e) {
                    $this->error("Erreur Meilisearch : " . $e->getMessage());
                }
                $this->waitForMeilisearch($host, $key);
            }

            if ($limit > 0 && $totalScanned >= $limit) {
                return false;
            }
        });

        $bar->finish();
        $this->newLine(2);

        $this->info("--- BILAN DE L'OPÉRATION ---");
        $this->info("Livres analysés : " . number_format($totalScanned, 0, ',', ' '));
        $this->info("Livres nettoyés : " . number_format($totalModified, 0, ',', ' ') . " (" . round(($totalModified / max(1, $totalScanned)) * 100, 2) . " %)");

        if (! empty($examples)) {
            $this->newLine();
            $this->comment("--- EXEMPLES REPRÉSENTATIFS (AVANT / APRÈS) ---");
            foreach ($examples as $idx => $ex) {
                $num = $idx + 1;
                $this->line("[$num] ID {$ex['id']} (ISBN {$ex['isbn_13']})");
                $this->line("   AVANT : {$ex['avant']}");
                $this->line("   APRÈS : \033[32m{$ex['apres']}\033[0m");
                $this->line("   Auteurs en base : {$ex['auteurs']}");
                $this->line("   -------------------------------------------------");
            }
        }

        // Traitement de la table listings si demandée
        if ($this->option('listings')) {
            $this->newLine();
            $this->info("=== NETTOYAGE DE LA TABLE LISTINGS (ANNONCES) ===");
            $listings = \App\Models\Listing::all();
            $listingsModified = 0;
            $modifiedListings = [];

            foreach ($listings as $listing) {
                $cleaned = $cleaner->clean($listing->title, $listing->author);
                if ($cleaned !== $listing->title) {
                    $listingsModified++;
                    $this->line("Listing #{$listing->id} (ISBN {$listing->isbn_13})");
                    $this->line("   AVANT : {$listing->title}");
                    $this->line("   APRÈS : \033[32m{$cleaned}\033[0m");

                    if (! $isDryRun) {
                        $listing->title = $cleaned;
                        $listing->save();
                        $modifiedListings[] = $listing;
                    }
                }
            }

            $this->info("Annonces modifiées : {$listingsModified} / " . $listings->count());

            if (! $isDryRun && $syncMeili && ! empty($modifiedListings)) {
                $this->info("Synchronisation de l'index Meilisearch des annonces...");
                foreach ($modifiedListings as $ml) {
                    $ml->searchable();
                }
                $this->info("✅ Index Meilisearch 'listings' mis à jour avec succès !");
            }
        }

        if ($isDryRun) {
            $this->newLine();
            $this->warn("Rappel : Mode SIMULATION terminé. Aucun changement appliqué.");
        } else {
            $this->newLine();
            $this->info("✅ Base de données mise à jour avec succès !");
            if ($syncMeili) {
                $this->info("✅ Meilisearch synchronisé avec l'intégralité des attributs !");
            }
        }

        return Command::SUCCESS;
    }

    private function waitForMeilisearch($host, $key)
    {
        while (true) {
            try {
                $response = Http::withToken($key)
                    ->timeout(10)
                    ->get("{$host}/tasks", [
                        'statuses' => 'enqueued,processing',
                    ]);

                if ($response->successful()) {
                    $tasks = $response->json('results', []);
                    if (count($tasks) < 20) {
                        break;
                    }
                }
            } catch (\Exception $e) {
            }
            sleep(1);
        }
    }
}
