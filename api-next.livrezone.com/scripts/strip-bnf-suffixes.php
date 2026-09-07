<?php
/*
 * strip-bnf-suffixes.php — Suppression des suffixes qualite BnF residuels
 * =========================================================================
 * Cible les entrees authors qui contiennent encore des mentions comme :
 *   "Philippe. Auteur du texte"
 *   "Michel (Auteur du texte)"
 *   "Dupont. Auteur du texte / Autrice du texte"
 *
 * Usage :
 *   docker exec php-fpm-8.5 php .../scripts/strip-bnf-suffixes.php --dry-run
 *   docker exec php-fpm-8.5 php .../scripts/strip-bnf-suffixes.php --apply
 *
 * Le champ `title` n'est jamais modifie.
 */

require '/var/www/html/api-next.livrezone.com/vendor/autoload.php';
$app = require '/var/www/html/api-next.livrezone.com/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------
$dryRun = in_array('--dry-run', $argv, true);
$apply  = in_array('--apply',   $argv, true);

if (!$dryRun && !$apply) {
    fwrite(STDERR, "Usage : php strip-bnf-suffixes.php --dry-run | --apply\n");
    exit(1);
}

$backupFile = '/tmp/strip_suffixes_backup.jsonl';
$modeLabel  = $dryRun ? 'DRY-RUN' : 'APPLY';
$chunkSize  = 5000;

echo str_repeat('=', 60) . PHP_EOL;
echo "  strip-bnf-suffixes.php -- " . date('Y-m-d H:i:s') . PHP_EOL;
echo "  Mode  : {$modeLabel}" . PHP_EOL;
if ($apply) echo "  Backup: {$backupFile}" . PHP_EOL;
echo str_repeat('=', 60) . PHP_EOL . PHP_EOL;

// ---------------------------------------------------------------------------
// Liste des suffixes a supprimer (toutes variantes)
// ---------------------------------------------------------------------------
$qualitySuffixes = [
    'Auteur(?:e)? du texte',
    'Autrice du texte',
    'Contributeur(?:s)?',
    'Directeur(?:s)? de (?:la )?publication',
    'Editeur scientifique',
    'Traducteur(?:e)?(?:s)?',
    'Illustrateur(?:s)?',
    'Cartographe(?:s)?',
    'Prefacier(?:e)?(?:s)?',
    'Postfacier(?:e)?(?:s)?',
    'Annotateur(?:s)?',
    'Collaborateur(?:s)?',
    'Responsable(?:s)?',
    'Directeur(?:s)?',
    'Coordinateur(?:s)?',
    'Photographe(?:s)?',
    'Scenariste(?:s)?',
    'Dessinateur(?:s)?',
    'Coloriste(?:s)?',
    'Auteur(?:s)?',
    'Autrice(?:s)?',
];
$alt = implode('|', $qualitySuffixes);

// Supprime : ". Qualite", "/ Qualite", "(Qualite)", dates biographiques
// Applique en boucle jusqu'a stabilite (cas de suffixes chaines)
function cleanAuthor(string $name, string $alt): string
{
    $prev = null;
    while ($prev !== $name) {
        $prev = $name;
        // ". Qualite / Qualite ..." en fin
        $name = preg_replace('/[.\/]\s*(?:' . $alt . ')(?:\s*\/\s*(?:' . $alt . '))*\s*$/iu', '', $name);
        // "(Qualite)" entre parentheses en fin
        $name = preg_replace('/\s*\(\s*(?:' . $alt . ')\s*\)\s*$/iu', '', $name);
        // Dates biographiques "(1974-....)" ou "(1622-1673)" en fin
        $name = preg_replace('/\s*\([^)]*\d{2,}[^)]*\)\s*$/u', '', $name);
        // Point ou slash final residuel
        $name = preg_replace('/[.\\/]\s*$/u', '', $name);
        $name = trim($name);
    }
    return $name;
}

// ---------------------------------------------------------------------------
// Filtre SQL : uniquement les livres dont authors contient le mot "Auteur"
// (optimisation : evite de parcourir les 700k lignes inutilement)
// ---------------------------------------------------------------------------
$total = DB::table('books')
    ->whereNotNull('authors')
    ->where('authors', '!=', '[]')
    ->where('authors', '!=', '')
    ->where('authors', 'LIKE', '%Auteur%')
    ->count();

echo "Livres candidats (authors contenant 'Auteur') : " . number_format($total, 0, ',', ' ') . PHP_EOL . PHP_EOL;

$backupFh     = null;
$changedCount = 0;
$elemFixed    = 0;
$processed    = 0;
$lastId       = 0;
$start        = microtime(true);

if ($apply) {
    $backupFh = fopen($backupFile, 'w');
    if (!$backupFh) { fwrite(STDERR, "Impossible d'ouvrir le backup : {$backupFile}\n"); exit(1); }
}

do {
    $rows = DB::table('books')
        ->select('id', 'authors')
        ->where('id', '>', $lastId)
        ->whereNotNull('authors')
        ->where('authors', '!=', '[]')
        ->where('authors', '!=', '')
        ->where('authors', 'LIKE', '%Auteur%')
        ->orderBy('id')
        ->limit($chunkSize)
        ->get();

    if ($rows->isEmpty()) break;

    $updates = [];

    foreach ($rows as $row) {
        $authors = json_decode((string) $row->authors, true);
        if (!is_array($authors)) continue;

        $authors = array_values(array_filter(
            array_map(fn($a) => trim((string) $a), $authors),
            fn($a) => $a !== ''
        ));
        if ($authors === []) continue;

        $newAuthors = array_map(fn($a) => cleanAuthor($a, $alt), $authors);
        // Retire les elements devenus vides apres nettoyage
        $newAuthors = array_values(array_filter($newAuthors, fn($a) => $a !== ''));

        if ($newAuthors === $authors) continue;

        $changedCount++;
        $elemFixed += count(array_diff($authors, $newAuthors)); // elements modifies

        $updates[] = [
            'id'          => (int) $row->id,
            'old_authors' => $authors,
            'new_authors' => $newAuthors,
        ];
    }

    if ($updates && $apply) {
        foreach ($updates as $u) {
            fwrite($backupFh, json_encode($u, JSON_UNESCAPED_UNICODE) . "\n");
            DB::table('books')->where('id', $u['id'])->update([
                'authors' => json_encode($u['new_authors'], JSON_UNESCAPED_UNICODE),
            ]);
        }
    } elseif ($updates && $dryRun) {
        foreach (array_slice($updates, 0, 8) as $u) {
            echo PHP_EOL . "  [#{$u['id']}] AVANT : " . json_encode($u['old_authors'], JSON_UNESCAPED_UNICODE) . PHP_EOL;
            echo           "         APRES : " . json_encode($u['new_authors'], JSON_UNESCAPED_UNICODE) . PHP_EOL;
        }
    }

    $lastId    = $rows->last()->id;
    $processed += $rows->count();
    $elapsed   = round(microtime(true) - $start);
    $pct       = $total > 0 ? round($processed / $total * 100, 1) : 0;
    echo "\r  " . str_pad(number_format($processed, 0, ',', ' '), 8)
        . " / " . number_format($total, 0, ',', ' ')
        . " ({$pct}%) | livres: {$changedCount} [{$elapsed}s]     ";

} while (true);

echo PHP_EOL;
if ($backupFh) fclose($backupFh);

echo PHP_EOL . str_repeat('=', 60) . PHP_EOL;
echo "  Termine" . PHP_EOL;
echo "  Livres modifies  : {$changedCount}" . PHP_EOL;
if ($apply) {
    echo "  Backup JSONL     : {$backupFile}" . PHP_EOL;
    echo PHP_EOL . "  Prochaine etape : reindexation Meilisearch" . PHP_EOL;
    echo "  -> relancer populate-authors-list-ephemere.php" . PHP_EOL;
}
echo str_repeat('=', 60) . PHP_EOL;
