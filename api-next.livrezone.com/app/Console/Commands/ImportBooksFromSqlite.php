<?php

namespace App\Console\Commands;

use App\Models\Category;
use App\Models\Language;
use App\Models\Level;
use App\Models\Subject;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

class ImportBooksFromSqlite extends Command
{
    protected $signature = 'books:import-sqlite {--path= : Le chemin absolu vers la base SQLite nextlivrezonedb.db}';

    protected $description = 'Importe et met à jour les livres en masse brute (Upsert) avec gestion automatique des deadlocks';

    public function handle()
    {
        $sqlitePath = $this->option('path') ?: base_path('nextlivrezonedb.db');

        if (! file_exists($sqlitePath)) {
            $this->error("Le fichier SQLite est introuvable à ce chemin : {$sqlitePath}");

            return Command::FAILURE;
        }

        $this->info("Connexion à la base SQLite : {$sqlitePath}...");

        try {
            $sqlite = new \PDO("sqlite:{$sqlitePath}");
            $sqlite->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
            $sqlite->setAttribute(\PDO::ATTR_DEFAULT_FETCH_MODE, \PDO::FETCH_ASSOC);
        } catch (\PDOException $e) {
            $this->error('Impossible de se connecter à SQLite : '.$e->getMessage());

            return Command::FAILURE;
        }

        try {
            $total = $sqlite->query('SELECT COUNT(*) FROM books')->fetchColumn();
        } catch (\Exception $e) {
            $this->error('Erreur lors de la lecture de la table books dans SQLite : '.$e->getMessage());

            return Command::FAILURE;
        }

        if ($total == 0) {
            $this->warn('La table books de SQLite est vide.');

            return Command::SUCCESS;
        }

        $this->info("Nombre total de livres à importer/mettre à jour : {$total}");

        $validLanguages = Language::pluck('id')->toArray();
        $validCategories = Category::pluck('id')->toArray();
        $validLevels = Level::pluck('id')->toArray();
        $validSubjects = Subject::pluck('id')->toArray();

        $chunkSize = 200;
        $offset = 0;
        $importedCount = 0;
        $now = now()->toDateTimeString();

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $stmt = $sqlite->prepare('SELECT * FROM books LIMIT :limit OFFSET :offset');

        while ($offset < $total) {
            $stmt->bindValue(':limit', $chunkSize, \PDO::PARAM_INT);
            $stmt->bindValue(':offset', $offset, \PDO::PARAM_INT);
            $stmt->execute();
            $rows = $stmt->fetchAll();

            if (empty($rows)) {
                break;
            }

            $batch = [];
            foreach ($rows as $row) {
                $langId = in_array($row['language_id'], $validLanguages) ? $row['language_id'] : null;
                $catId = in_array($row['default_category_id'], $validCategories) ? $row['default_category_id'] : null;
                $levelId = in_array($row['default_level_id'], $validLevels) ? $row['default_level_id'] : null;
                $subId = in_array($row['default_subject_id'], $validSubjects) ? $row['default_subject_id'] : null;

                $pubDate = null;
                if (! empty($row['publication_date'])) {
                    try {
                        $pubDate = Carbon::parse($row['publication_date'])->toDateString();
                    } catch (\Exception $e) {
                        $pubDate = null;
                    }
                }

                $authorsJson = null;
                if (! empty($row['authors'])) {
                    $decoded = json_decode($row['authors'], true);
                    $authorsJson = is_array($decoded) ? json_encode($decoded) : json_encode([$row['authors']]);
                }

                $batch[] = [
                    'isbn_13' => $row['isbn_13'],
                    'title' => $row['title'],
                    'normalized_title' => $row['normalized_title'],
                    'authors' => $authorsJson,
                    'publisher' => $row['publisher'],
                    'description' => $row['description'],
                    'publication_date' => $pubDate,
                    'language_id' => $langId,
                    'page_count' => $row['page_count'],
                    'indicative_price' => $row['indicative_price'],
                    'indicative_price_currency' => $row['indicative_price_currency'] ?? 'MAD',
                    'cover_path' => $row['cover_path'],
                    'cover_source_url' => $row['cover_source_url'],
                    'default_category_id' => $catId,
                    'default_level_id' => $levelId,
                    'default_subject_id' => $subId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            $maxRetries = 3;
            $retryCount = 0;
            $success = false;

            while ($retryCount < $maxRetries && ! $success) {
                try {
                    DB::table('books')->upsert(
                        $batch,
                        ['isbn_13'],
                        [
                            'title', 'normalized_title', 'authors', 'publisher', 'description',
                            'publication_date', 'language_id', 'page_count', 'indicative_price',
                            'indicative_price_currency', 'cover_path', 'cover_source_url',
                            'default_category_id', 'default_level_id', 'default_subject_id', 'updated_at',
                        ]
                    );
                    $importedCount += count($batch);
                    $success = true;
                } catch (QueryException $e) {
                    if ($e->getCode() === '40001' || str_contains($e->getMessage(), '1213 Deadlock')) {
                        $retryCount++;
                        $this->warn("\n[Deadlock] Essai {$retryCount}/{$maxRetries} pour le lot offset {$offset}. Pause 100ms...");
                        usleep(100000);
                    } else {
                        $this->newLine();
                        $this->error('Erreur de requête SQL : '.$e->getMessage());

                        return Command::FAILURE;
                    }
                }
            }

            if (! $success) {
                $this->newLine();
                $this->error("Échec d'insertion du lot après {$maxRetries} tentatives de résolution de deadlock.");

                return Command::FAILURE;
            }

            $bar->advance(count($rows));
            $offset += $chunkSize;
        }

        $bar->finish();
        $this->newLine();
        $this->info("Importation et Mise à jour Bulk terminées avec succès ! {$importedCount} livres synchronisés.");

        return Command::SUCCESS;
    }
}
