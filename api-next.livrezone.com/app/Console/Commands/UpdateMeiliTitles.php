<?php
namespace App\Console\Commands;

use App\Models\Book;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class UpdateMeiliTitles extends Command
{
    protected $signature = 'books:update-meili';
    protected $description = 'Etape 2 : Envoie uniquement les livres corrigés vers Meilisearch';

    public function handle()
    {
        config(['scout.queue' => false]);
        $host = config('scout.meilisearch.host', env('MEILISEARCH_HOST'));
        $key = config('scout.meilisearch.key', env('MEILISEARCH_KEY'));

        // On cible uniquement les livres qui contiennent un deux-points ou qui sont très longs
        $query = Book::where('title', 'LIKE', '%:%')
            ->orWhere('normalized_title', 'LIKE', '%:%')
            ->orWhereRaw('LENGTH(title) >= 250')
            ->orWhereRaw('LENGTH(normalized_title) >= 250');
            
        $total = $query->count();
        
        if ($total === 0) {
            $this->info("Aucun livre ne correspond.");
            return Command::SUCCESS;
        }

        $this->info("Étape 2 : Envoi de {$total} livres vers Meilisearch...");
        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $query->chunkById(500, function ($books) use ($bar, $host, $key) {
            try {
                $books->searchable();
            } catch (\Exception $e) {}
            
            $this->waitForMeilisearch($host, $key);
            $bar->advance($books->count());
        });

        $bar->finish();
        $this->newLine();
        $this->info("✅ Meilisearch est à jour !");
    }
    
    private function waitForMeilisearch($host, $key)
    {
        while (true) {
            try {
                $response = Http::withToken($key)->timeout(10)->get("{$host}/tasks", ['statuses' => 'enqueued,processing']);
                if ($response->successful()) {
                    $tasks = $response->json('results', []);
                    if (count($tasks) < 20) { 
                        break;
                    }
                }
            } catch (\Exception $e) {}
            sleep(1);
        }
    }
}
