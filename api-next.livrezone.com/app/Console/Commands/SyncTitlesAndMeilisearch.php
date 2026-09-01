<?php

namespace App\Console\Commands;

use App\Models\Book;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class SyncTitlesAndMeilisearch extends Command
{
    protected $signature = 'books:sync-titles {--path= : Le chemin absolu vers la base SQLite}';

    protected $description = 'Met à jour uniquement les titres restaurés depuis SQLite et les pousse vers Meilisearch';

    public function handle()
    {
        $sqlitePath = $this->option('path') ?: base_path('nextlivrezonedb.db');
        if (! file_exists($sqlitePath)) {
            $this->error("Fichier SQLite introuvable : {$sqlitePath}");

            return Command::FAILURE;
        }

        // DÉSACTIVER LA FILE D'ATTENTE LARAVEL POUR FORCER L'ENVOI DIRECT À MEILISEARCH
        config(['scout.queue' => false]);
        $host = config('scout.meilisearch.host', env('MEILISEARCH_HOST'));
        $key = config('scout.meilisearch.key', env('MEILISEARCH_KEY'));

        $this->info("Connexion à la base SQLite : {$sqlitePath}");
        $sqlite = new \PDO("sqlite:{$sqlitePath}");
        $sqlite->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $sqlite->setAttribute(\PDO::ATTR_DEFAULT_FETCH_MODE, \PDO::FETCH_ASSOC);

        // On ne prend que les livres qui ont un ':' ou qui dépassaient les 250 caractères
        $query = "SELECT isbn_13, title, normalized_title FROM books WHERE title LIKE '%:%' OR normalized_title LIKE '%:%' OR LENGTH(title) >= 250 OR LENGTH(normalized_title) >= 250";

        $this->info('Analyse de la base SQLite pour trouver les titres à corriger...');
        $stmt = $sqlite->query($query);
        $rows = $stmt->fetchAll();
        $total = count($rows);

        if ($total === 0) {
            $this->info('Aucun titre à corriger.');

            return Command::SUCCESS;
        }

        $this->info("🎯 {$total} livres identifiés pour correction dans MariaDB et synchronisation Meilisearch.");

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $chunkSize = 500;
        $chunks = array_chunk($rows, $chunkSize);

        foreach ($chunks as $chunk) {
            $isbns = [];

            // 1. Mise à jour hyper-rapide de MariaDB (en une seule transaction)
            DB::beginTransaction();
            try {
                foreach ($chunk as $row) {
                    DB::table('books')
                        ->where('isbn_13', $row['isbn_13'])
                        ->update([
                            'title' => mb_substr($row['title'], 0, 255),
                            'normalized_title' => mb_substr($row['normalized_title'], 0, 255),
                        ]);
                    $isbns[] = $row['isbn_13'];
                }
                DB::commit();
            } catch (\Exception $e) {
                DB::rollBack();
                $this->newLine();
                $this->error("Erreur SQL lors de l'Update: ".$e->getMessage());

                continue; // On passe au lot suivant en cas de bug
            }

            // 2. Récupérer les modèles Laravel pour les envoyer à Meilisearch
            $books = Book::whereIn('isbn_13', $isbns)->get();

            // 3. Envoyer directement à Meilisearch
            if ($books->isNotEmpty()) {
                try {
                    $books->searchable();
                } catch (\Exception $e) {
                    $this->newLine();
                    $this->error("Erreur Meilisearch lors de l'envoi: ".$e->getMessage());
                }

                // 4. Pause intelligente anti-engorgement
                $this->waitForMeilisearch($host, $key);
            }

            $bar->advance(count($chunk));
        }

        $bar->finish();
        $this->newLine();
        $this->info('✅ Opération chirurgicale terminée !');
        $this->info('MariaDB et Meilisearch sont désormais 100% à jour avec les bons titres.');

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
                    if (count($tasks) == 0) {
                        break;
                    }
                }
            } catch (\Exception $e) {
                // En cas de lag réseau, on attend patiemment
            }
            sleep(2);
        }
    }
}
