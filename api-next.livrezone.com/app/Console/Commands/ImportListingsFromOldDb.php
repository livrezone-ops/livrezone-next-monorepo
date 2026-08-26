<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ImportListingsFromOldDb extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'listings:import-old 
                            {--host=172.20.0.3 : L\'hôte de la base de données source}
                            {--port=3306 : Le port de la base de données source}
                            {--database=livrezonedb : Le nom de la base de données source}
                            {--username=livrezone : L\'utilisateur de la base de données source}
                            {--password=MarocMaroc2026 : Le mot de passe de la base de données source}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Importe et synchronise les annonces de l\'ancienne base vers la nouvelle avec mapping des IDs par code';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info("Configuration de la connexion à l'ancienne base...");

        config(['database.connections.old_db' => [
            'driver' => 'mysql',
            'host' => $this->option('host'),
            'port' => $this->option('port'),
            'database' => $this->option('database'),
            'username' => $this->option('username'),
            'password' => $this->option('password'),
            'charset' => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
            'prefix' => '',
        ]]);

        try {
            // Tester la connexion
            DB::connection('old_db')->getPdo();
            $this->info("Connexion établie avec succès à l'ancienne base !");
        } catch (\Exception $e) {
            $this->error("Erreur de connexion à l'ancienne base de données : ".$e->getMessage());
            $this->warn("Vérifiez les paramètres réseau de votre Docker. Si nécessaire, passez l'option --host= avec l'IP du serveur host.");

            return Command::FAILURE;
        }

        // 1. Charger la table de correspondance (mapping) pour éviter les décalages d'IDs
        $this->info('Chargement des tables de correspondance par code...');

        // Catégories
        $oldCategories = DB::connection('old_db')->table('categories')->pluck('code', 'id')->toArray();
        $newCategories = DB::table('categories')->pluck('id', 'code')->toArray();

        // Niveaux
        $oldLevels = DB::connection('old_db')->table('levels')->pluck('code', 'id')->toArray();
        $newLevels = DB::table('levels')->pluck('id', 'code')->toArray();

        // Matières
        $oldSubjects = DB::connection('old_db')->table('subjects')->pluck('code', 'id')->toArray();
        $newSubjects = DB::table('subjects')->pluck('id', 'code')->toArray();

        // Langues
        $oldLanguages = DB::connection('old_db')->table('languages')->pluck('code', 'id')->toArray();
        $newLanguages = DB::table('languages')->pluck('id', 'code')->toArray();

        // 2. Récupérer le nombre d'annonces
        $totalListings = DB::connection('old_db')->table('listings')->count();
        $this->info("Nombre total d'annonces à importer : {$totalListings}");

        if ($totalListings === 0) {
            $this->warn('Aucune annonce trouvée dans la base source.');

            return Command::SUCCESS;
        }

        // Vider la table actuelle pour éviter les doublons ou conflits de clés primaires
        $this->warn('Vider la table listings existante...');
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        DB::table('listings')->truncate();

        $bar = $this->output->createProgressBar($totalListings);
        $bar->start();

        // Charger par lots de 200 pour éviter la saturation mémoire
        DB::connection('old_db')->table('listings')->orderBy('id')->chunk(200, function ($rows) use (
            $oldCategories, $newCategories,
            $oldLevels, $newLevels,
            $oldSubjects, $newSubjects,
            $oldLanguages, $newLanguages,
            $bar
        ) {
            $batch = [];
            foreach ($rows as $row) {
                // Résoudre les correspondances de taxonomie
                $catCode = $oldCategories[$row->category_id] ?? null;
                $newCatId = $catCode ? ($newCategories[$catCode] ?? null) : null;

                $levelCode = $oldLevels[$row->level_id] ?? null;
                $newLevelId = $levelCode ? ($newLevels[$levelCode] ?? null) : null;

                $subCode = $oldSubjects[$row->subject_id] ?? null;
                $newSubId = $subCode ? ($newSubjects[$subCode] ?? null) : null;

                $langCode = $oldLanguages[$row->language_id] ?? null;
                $newLangId = $langCode ? ($newLanguages[$langCode] ?? null) : null;

                // Résoudre le book_id en cherchant par isbn_13 dans la nouvelle table books
                $newBookId = null;
                if (! empty($row->isbn_13)) {
                    $newBookId = DB::table('books')->where('isbn_13', $row->isbn_13)->value('id');
                }

                // Vérifier si l'utilisateur existe dans la nouvelle table pour éviter les violations FK
                $userExists = DB::table('users')->where('id', $row->user_id)->exists();
                if (! $userExists) {
                    // Ignorer les annonces sans utilisateur valide dans la nouvelle base
                    $bar->advance();

                    continue;
                }

                // Vérifier si le reviewed_by existe
                $reviewedBy = null;
                if ($row->reviewed_by && DB::table('users')->where('id', $row->reviewed_by)->exists()) {
                    $reviewedBy = $row->reviewed_by;
                }

                $batch[] = [
                    'id' => $row->id,
                    'user_id' => $row->user_id,
                    'listing_type' => $row->listing_type ?? 'single',
                    'book_id' => $newBookId,
                    'isbn_13' => $row->isbn_13,
                    'title' => $row->title,
                    'description' => $row->description,
                    'book_condition' => $row->book_condition ?? 'occas',
                    'price' => $row->price,
                    'discount_price' => $row->discount_price,
                    'currency' => $row->currency ?? 'MAD',
                    'quantity' => $row->quantity ?? 1,
                    'cover_path' => $row->cover_path,
                    'cover_source_url' => $row->cover_source_url,
                    'category_id' => $newCatId,
                    'level_id' => $newLevelId,
                    'subject_id' => $newSubId,
                    'language_id' => $newLangId,
                    'status' => $row->status ?? 'pending_admin',
                    'submitted_at' => $row->submitted_at,
                    'reviewed_at' => $row->reviewed_at,
                    'reviewed_by' => $reviewedBy,
                    'moderation_note' => $row->moderation_note,
                    'published_at' => $row->published_at,
                    'deleted_at' => $row->deleted_at,
                    'created_at' => $row->created_at,
                    'updated_at' => $row->updated_at,
                ];
            }

            if (! empty($batch)) {
                DB::table('listings')->insert($batch);
                $bar->advance(count($batch));
            }
        });

        DB::statement('SET FOREIGN_KEY_CHECKS=1;');
        $bar->finish();
        $this->newLine();
        $this->info('Importation et mapping des annonces terminés avec succès !');

        return Command::SUCCESS;
    }
}
