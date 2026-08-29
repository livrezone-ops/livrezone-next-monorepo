<?php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class UpdateDbTitles extends Command
{
    protected $signature = 'books:update-db {--path= : Chemin SQLite}';
    protected $description = 'Etape 1 : Met à jour uniquement MariaDB depuis SQLite (sans toucher à Meilisearch)';

    public function handle()
    {
        $sqlitePath = $this->option('path') ?: base_path('nextlivrezonedb.db');
        if (! file_exists($sqlitePath)) {
            $this->error("Fichier SQLite introuvable : {$sqlitePath}");
            return Command::FAILURE;
        }

        $sqlite = new \PDO("sqlite:{$sqlitePath}");
        $sqlite->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $query = "SELECT isbn_13, title, normalized_title FROM books WHERE title LIKE '%:%' OR normalized_title LIKE '%:%' OR LENGTH(title) >= 250 OR LENGTH(normalized_title) >= 250";
        $rows = $sqlite->query($query)->fetchAll(\PDO::FETCH_ASSOC);
        $total = count($rows);
        
        if ($total === 0) {
            $this->info("Aucun titre à corriger.");
            return Command::SUCCESS;
        }

        $this->info("Étape 1 : Mise à jour de MariaDB pour {$total} livres...");
        $bar = $this->output->createProgressBar($total);
        $bar->start();
        
        $chunks = array_chunk($rows, 1000);

        foreach ($chunks as $chunk) {
            DB::beginTransaction();
            try {
                foreach ($chunk as $row) {
                    DB::table('books')->where('isbn_13', $row['isbn_13'])->update([
                        'title' => mb_substr($row['title'], 0, 255),
                        'normalized_title' => mb_substr($row['normalized_title'], 0, 255)
                    ]);
                }
                DB::commit();
            } catch (\Exception $e) {
                DB::rollBack();
                $this->error("Erreur SQL: " . $e->getMessage());
            }
            $bar->advance(count($chunk));
        }
        
        $bar->finish();
        $this->newLine();
        $this->info("✅ MariaDB est à jour !");
    }
}
