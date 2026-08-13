<?php

// Suppress errors to get clean execution
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Bootstrap Laravel
require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Listing;
use Illuminate\Support\Facades\DB;

$out = [];
$out[] = "=== DIAGNOSTIC DES COUVERTURES DE LIVRES ===";
$out[] = "Date : " . date('Y-m-d H:i:s');

// 1. Lister les configurations importantes
$out[] = "\n--- CONFIGURATIONS ---";
$out[] = "APP_URL : " . config('app.url');
$out[] = "BOOK_COVERS_URL env : " . env('BOOK_COVERS_URL');
$out[] = "BOOK_COVERS_PUBLIC_PATH env : " . env('BOOK_COVERS_PUBLIC_PATH');
$out[] = "Disk book_covers_public root : " . config('filesystems.disks.book_covers_public.root');

// 2. Vérifier l'existence physique du dossier de base
$publicRoot = config('filesystems.disks.book_covers_public.root');
$baseRoot = basename($publicRoot) === 'originals' ? dirname($publicRoot) : $publicRoot;
$out[] = "\n--- CHEMINS PHYSIQUES ---";
$out[] = "baseRoot résolu : " . $baseRoot;
$out[] = "Existe-t-il ? : " . (file_exists($baseRoot) ? "OUI" : "NON");
if (file_exists($baseRoot)) {
    $out[] = "Est-ce lisible ? : " . (is_readable($baseRoot) ? "OUI" : "NON");
    
    // Lister quelques fichiers ou dossiers
    $files = scandir($baseRoot);
    $out[] = "Contenu de baseRoot : " . implode(', ', array_slice($files, 0, 10));
    
    $originals = $baseRoot . '/originals';
    $out[] = "Dossier originals existe ? : " . (file_exists($originals) ? "OUI" : "NON");
    if (file_exists($originals)) {
        $out[] = "Contenu de originals (5 items) : " . implode(', ', array_slice(scandir($originals), 0, 7));
    }
} else {
    // Si baseRoot n'existe pas, essayons d'analyser le dossier parent ou des chemins communs
    $out[] = "Dossier /data existe ? : " . (file_exists('/data') ? "OUI" : "NON");
    if (file_exists('/data')) {
        $out[] = "Contenu de /data : " . implode(', ', scandir('/data'));
        $out[] = "Dossier /data/books existe ? : " . (file_exists('/data/books') ? "OUI" : "NON");
        if (file_exists('/data/books')) {
            $out[] = "Contenu de /data/books : " . implode(', ', scandir('/data/books'));
        }
    }
}

// 3. Charger 5 annonces et analyser leurs chemins
$out[] = "\n--- ANALYSE DE 5 ANNONCES ---";
$listings = Listing::with('book')->whereNotNull('book_id')->take(5)->get();
if ($listings->isEmpty()) {
    $listings = Listing::take(5)->get();
}

foreach ($listings as $l) {
    $out[] = "\nAnnonce ID : " . $l->id;
    $out[] = "Titre : " . $l->title;
    $out[] = "ISBN : " . $l->isbn_13;
    $out[] = "Cover Path (listing) : " . $l->cover_path;
    
    if ($l->book) {
        $out[] = "Livre lié ID : " . $l->book->id;
        $out[] = "Cover Path (book) : " . $l->book->cover_path;
        $out[] = "Cover URL (book->cover_url) : " . $l->book->cover_url;
        
        // Tester l'existence physique du fichier généré par le path
        $path = trim((string)($l->book->cover_path ?? ''));
        if ($path !== '') {
            $cleanPath = ltrim(str_replace('originals/', '', $path), '/');
            $fullPath = rtrim($baseRoot, '/') . '/originals/' . $cleanPath;
            $out[] = "Chemin physique attendu (original) : " . $fullPath;
            $out[] = "Fichier existe ? : " . (file_exists($fullPath) ? "OUI" : "NON");
            
            // Si non trouvé, tester le dossier splitté (ex: 12/978...jpg)
            if (!file_exists($fullPath)) {
                $filename = basename($cleanPath);
                $folder = substr(pathinfo($filename, PATHINFO_FILENAME), -2);
                if (!is_numeric($folder)) {
                    $folder = '00';
                }
                $splitFullPath = rtrim($baseRoot, '/') . '/originals/' . $folder . '/' . $filename;
                $out[] = "Chemin physique attendu (split) : " . $splitFullPath;
                $out[] = "Fichier split existe ? : " . (file_exists($splitFullPath) ? "OUI" : "NON");
            }
        }
    } else {
        $out[] = "Aucun livre lié.";
    }
}

$logContent = implode("\n", $out);
file_put_contents(__DIR__ . '/test-covers.log', $logContent);
echo "Diagnostic terminé. Log écrit dans public/test-covers.log\n";
echo "<pre>\n" . htmlspecialchars($logContent) . "\n</pre>";
