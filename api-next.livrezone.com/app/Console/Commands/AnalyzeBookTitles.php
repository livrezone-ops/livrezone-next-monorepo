<?php

namespace App\Console\Commands;

use App\Models\Book;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class AnalyzeBookTitles extends Command
{
    protected $signature = 'books:analyze-titles {--limit=10 : Nombre d\'exemples par catégorie}';
    protected $description = 'Analyse les titres de la table books pour identifier les formats composites (titre + auteur + métadonnées)';

    public function handle()
    {
        $limit = (int) $this->option('limit');
        $this->info("=== ANALYSE DES TITRES DANS LA TABLE BOOKS ===");

        $totalBooks = DB::table('books')->count();
        $this->info("Nombre total de livres : " . number_format($totalBooks, 0, ',', ' '));

        // 1. Longueurs des titres
        $this->newLine();
        $this->info("--- 1. DISTRIBUTION PAR LONGUEUR DU TITRE ---");
        $lengthStats = DB::select("
            SELECT 
                SUM(CASE WHEN CHAR_LENGTH(title) <= 40 THEN 1 ELSE 0 END) as lte_40,
                SUM(CASE WHEN CHAR_LENGTH(title) > 40 AND CHAR_LENGTH(title) <= 70 THEN 1 ELSE 0 END) as btwn_41_70,
                SUM(CASE WHEN CHAR_LENGTH(title) > 70 AND CHAR_LENGTH(title) <= 100 THEN 1 ELSE 0 END) as btwn_71_100,
                SUM(CASE WHEN CHAR_LENGTH(title) > 100 AND CHAR_LENGTH(title) <= 150 THEN 1 ELSE 0 END) as btwn_101_150,
                SUM(CASE WHEN CHAR_LENGTH(title) > 150 THEN 1 ELSE 0 END) as gt_150
            FROM books
        ")[0];

        $this->table(
            ['Longueur', 'Nombre', '% du catalogue'],
            [
                ['<= 40 caractères', number_format($lengthStats->lte_40, 0, ',', ' '), round(($lengthStats->lte_40 / $totalBooks) * 100, 2) . '%'],
                ['41 à 70 caractères', number_format($lengthStats->btwn_41_70, 0, ',', ' '), round(($lengthStats->btwn_41_70 / $totalBooks) * 100, 2) . '%'],
                ['71 à 100 caractères', number_format($lengthStats->btwn_71_100, 0, ',', ' '), round(($lengthStats->btwn_71_100 / $totalBooks) * 100, 2) . '%'],
                ['101 à 150 caractères', number_format($lengthStats->btwn_101_150, 0, ',', ' '), round(($lengthStats->btwn_101_150 / $totalBooks) * 100, 2) . '%'],
                ['> 150 caractères', number_format($lengthStats->gt_150, 0, ',', ' '), round(($lengthStats->gt_150 / $totalBooks) * 100, 2) . '%'],
            ]
        );

        // 2. Détection de séparateurs et motifs caractéristiques
        $this->newLine();
        $this->info("--- 2. DÉTECTION DES MOTIFS ET PARASITES COURANTS ---");
        $patterns = [
            'Deux-points " : " (Sous-titres)' => "% : %",
            'Parenthèses "(...)"' => "%(%)%",
            'Point-virgule " ; " (Mentions auteurs / resp.)' => "% ; %",
            'Crochets "[...]"' => "%[%]%",
            'Suspension BNF ",..."' => "%,...%",
            'Tiret avec espaces " - "' => "% - %",
            'Mention d\'édition "(... éd.)"' => "% éd.%)%",
            'Mention " coordination / direction / collectif "' => "%direction de%",
            'Mention " illustré par / trad. par / avec la coll. "' => "%collaboration de%",
            'Mention " Tome "' => "% Tome %",
            'Mention " Vol. / Volume "' => "%Vol%",
        ];

        $patternResults = [];
        foreach ($patterns as $label => $like) {
            $cnt = DB::table('books')->where('title', 'LIKE', $like)->count();
            $patternResults[] = [$label, number_format($cnt, 0, ',', ' '), round(($cnt / $totalBooks) * 100, 2) . '%'];
        }
        $this->table(['Motif / Séparateur', 'Nombre', '% du catalogue'], $patternResults);

        // 3. Exemples concrets des parasites BNF / Auteurs / Editions
        $this->newLine();
        $this->info("--- 3. EXEMPLES DÉTAILLÉS DE PARASITAGE DES TITRES ---");

        $bnnSamples = DB::table('books')
            ->select('id', 'isbn_13', 'title', 'authors', 'publisher')
            ->where('title', 'LIKE', '%,...%')
            ->limit(10)
            ->get();

        $this->comment(">> A. Titres avec ponctuation BNF ',...' (Auteurs/contributeurs injectés dans le titre) :");
        foreach ($bnnSamples as $s) {
            $this->line("   [ID {$s->id} | {$s->isbn_13}]");
            $this->line("   TITRE ACTUEL: {$s->title}");
            $this->line("   AUTEUR ENREGISTRÉ: {$s->authors}");
            $this->line("   -------------------------------------------------");
        }

        $edTrailingSamples = DB::table('books')
            ->select('id', 'isbn_13', 'title', 'authors')
            ->where('title', 'LIKE', '% éd.%) %')
            ->limit(10)
            ->get();

        $this->newLine();
        $this->comment(">> B. Titres avec texte APRES la mention d'édition '(Xe éd.)' :");
        foreach ($edTrailingSamples as $s) {
            $this->line("   [ID {$s->id}] {$s->title}");
            $this->line("   Auteurs: {$s->authors}");
            $this->line("   -------------------------------------------------");
        }

        $semicolonSamples = DB::table('books')
            ->select('id', 'isbn_13', 'title', 'authors')
            ->where('title', 'LIKE', '% ; %')
            ->limit(5)
            ->get();

        $this->newLine();
        $this->comment(">> C. Titres avec point-virgule ' ; ' (co-auteurs / contributeurs secondaires) :");
        foreach ($semicolonSamples as $s) {
            $this->line("   [ID {$s->id}] {$s->title}");
        }

        // 4. Titres très longs (> 100 caractères)
        $this->newLine();
        $this->info("--- 4. EXEMPLES DE TITRES TRÈS LONGS (> 100 CARACTÈRES) ---");
        $longSamples = DB::table('books')
            ->select('id', 'isbn_13', 'title', 'authors', 'publisher', 'metadata_source')
            ->whereRaw('CHAR_LENGTH(title) > 100')
            ->limit($limit)
            ->get();

        foreach ($longSamples as $s) {
            $this->line("   [ID {$s->id} | Longueur: " . mb_strlen($s->title) . " car.]");
            $this->line("   Titre: {$s->title}");
            $this->line("   Auteurs: {$s->authors} | Editeur: {$s->publisher} | Source: {$s->metadata_source}");
            $this->line("   -------------------------------------------------");
        }

        // 5. Analyse : Titre contenant le nom d'un de ses auteurs
        $this->newLine();
        $this->info("--- 5. RECHERCHE D'AUTEURS INCLUS DANS LE TITRE ---");
        $this->info("Échantillonnage de 50 000 livres pour évaluer le taux de répétition Titre/Auteur...");

        $sampleBooks = DB::table('books')
            ->select('id', 'isbn_13', 'title', 'authors')
            ->whereNotNull('authors')
            ->where('authors', '!=', '[]')
            ->where('authors', '!=', '')
            ->limit(50000)
            ->get();

        $authorInTitleCount = 0;
        $authorInTitleExamples = [];

        foreach ($sampleBooks as $b) {
            $authors = json_decode($b->authors, true);
            if (!is_array($authors)) {
                $authors = array_filter(array_map('trim', explode(',', (string) $b->authors)));
            }

            foreach ($authors as $author) {
                $authorClean = trim((string) $author);
                // On vérifie seulement si le nom de l'auteur a au moins 4 lettres pour éviter les faux positifs
                if (mb_strlen($authorClean) >= 4 && mb_stripos($b->title, $authorClean) !== false) {
                    $authorInTitleCount++;
                    if (count($authorInTitleExamples) < $limit) {
                        $authorInTitleExamples[] = [
                            'id' => $b->id,
                            'title' => $b->title,
                            'author' => $authorClean,
                        ];
                    }
                    break;
                }
            }
        }

        $rate = round(($authorInTitleCount / max(1, count($sampleBooks))) * 100, 2);
        $extrapolated = round(($authorInTitleCount / max(1, count($sampleBooks))) * $totalBooks);
        $this->line("Sur l'échantillon de " . count($sampleBooks) . " livres :");
        $this->line("- Livres avec auteur dans le titre : $authorInTitleCount ($rate %)");
        $this->line("- Estimation sur l'ensemble du catalogue : environ " . number_format($extrapolated, 0, ',', ' ') . " livres");

        $this->newLine();
        $this->comment("Exemples où l'auteur est répété dans le titre :");
        foreach ($authorInTitleExamples as $ex) {
            $this->line("   [ID {$ex['id']}] Titre: {$ex['title']}");
            $this->line("   Auteur détecté dans le titre: {$ex['author']}");
            $this->line("   -------------------------------------------------");
        }

        // 6. Vérification de la table listings
        $this->newLine();
        $this->info("--- 6. ÉTAT DE LA TABLE LISTINGS (ANNONCES UTILISATEURS) ---");
        $totalListings = DB::table('listings')->count();
        $cleaner = app(\App\Services\BookTitleCleanerService::class);
        $pollutedListings = 0;
        $listingsExamples = [];

        $listings = DB::table('listings')->select('id', 'title', 'author')->get();
        foreach ($listings as $l) {
            $cleaned = $cleaner->clean($l->title, $l->author);
            if ($cleaned !== $l->title) {
                $pollutedListings++;
                if (count($listingsExamples) < 5) {
                    $listingsExamples[] = [
                        'id' => $l->id,
                        'avant' => $l->title,
                        'apres' => $cleaned,
                    ];
                }
            }
        }

        $this->line("Total annonces en ligne : {$totalListings}");
        $this->line("Annonces nécessitant un nettoyage : {$pollutedListings}");
        foreach ($listingsExamples as $le) {
            $this->line("   [Listing #{$le['id']}]");
            $this->line("   AVANT : {$le['avant']}");
            $this->line("   APRÈS : {$le['apres']}");
        }

        return Command::SUCCESS;
    }
}
