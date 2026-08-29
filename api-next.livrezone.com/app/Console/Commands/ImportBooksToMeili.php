<?php

namespace App\Console\Commands;

use App\Models\Book;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class ImportBooksToMeili extends Command
{
    protected $signature = 'books:import-meili {--chunk=500} {--start-id=0}';
    protected $description = 'Importation massive vers Meilisearch avec pause intelligente (vérification de la file d\'attente)';

    public function handle()
    {
        $chunkSize = (int) $this->option('chunk');
        $startId = (int) $this->option('start-id');
        
        $host = config('scout.meilisearch.host', env('MEILISEARCH_HOST'));
        $key = config('scout.meilisearch.key', env('MEILISEARCH_KEY'));

        // DÉSACTIVER LA FILE D'ATTENTE LARAVEL POUR FORCER L'ENVOI DIRECT À MEILISEARCH
        config(['scout.queue' => false]);

        $this->info("Début de l'importation intelligente et DIRECTE vers Meilisearch...");
        
        $query = Book::query();
        if ($startId > 0) {
            $query->where('id', '>=', $startId);
            $this->info("Reprise à partir de l'ID : {$startId}");
        }
        
        $total = $query->count();
        if ($total === 0) {
            $this->info("Aucun livre à importer.");
            return 0;
        }

        $this->info("Total à indexer : {$total} livres (Lots de {$chunkSize}).");
        
        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $query->chunkById($chunkSize, function ($books) use ($bar, $host, $key) {
            try {
                // L'envoi se fait maintenant directement en HTTP à Meilisearch (sans passer par MariaDB)
                $books->searchable();
            } catch (\Exception $e) {
                $this->newLine();
                $this->error("Erreur lors de l'envoi du lot : " . $e->getMessage());
            }
            $bar->advance($books->count());
            
            // On vérifie la vraie file d'attente de Meilisearch
            $this->waitForMeilisearch($host, $key);
        });

        $bar->finish();
        $this->newLine();
        $this->info("✅ Envoi terminé avec succès !");
        return 0;
    }
    
    private function waitForMeilisearch($host, $key)
    {
        while (true) {
            try {
                $response = Http::withToken($key)
                                ->timeout(10)
                                ->get("{$host}/tasks", [
                                    'statuses' => 'enqueued,processing'
                                ]);
                                
                if ($response->successful()) {
                    $tasks = $response->json('results', []);
                    if (count($tasks) == 0) { 
                        break;
                    }
                }
            } catch (\Exception $e) {
                // Timeout
            }
            sleep(2);
        }
    }
}
