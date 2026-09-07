<?php
/*
 * correct-authors.php — Normalisation BnF des auteurs (table books) — phase 1
 * ===========================================================================
 * Execute via :
 *   docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/scripts/correct-authors.php --dry-run
 *   docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/scripts/correct-authors.php --apply
 *
 * Corrections :
 *   - Paire ["Nom", "Prenom (dates). Qualite"] -> "Prenom Nom"
 *   - Element autonome "Moliere (1622-1673). Auteur du texte" -> "Moliere"
 *
 * Garde-fous :
 *   - Le champ `title` n'est JAMAIS modifie.
 *   - Backup JSONL avant tout UPDATE (rollback possible).
 *   - Collectivites longues conservees telles quelles.
 */

require '/var/www/html/api-next.livrezone.com/vendor/autoload.php';
$app = require '/var/www/html/api-next.livrezone.com/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------
$dryRun    = in_array('--dry-run', $argv, true);
$apply     = in_array('--apply',   $argv, true);
$chunkSize = 5000;

if (!$dryRun && !$apply) {
    fwrite(STDERR, "Usage : php correct-authors.php --dry-run | --apply\n");
    exit(1);
}

$modeLabel  = $dryRun ? 'DRY-RUN (aucune modification)' : 'APPLY (modifications en base)';
$backupFile = '/tmp/correction_authors_backup.jsonl';

echo str_repeat('=', 60) . PHP_EOL;
echo "  correct-authors.php -- " . date('Y-m-d H:i:s') . PHP_EOL;
echo "  Mode  : {$modeLabel}" . PHP_EOL;
echo "  Chunk : {$chunkSize}" . PHP_EOL;
if ($apply) echo "  Backup: {$backupFile}" . PHP_EOL;
echo str_repeat('=', 60) . PHP_EOL . PHP_EOL;

// ---------------------------------------------------------------------------
// Suffixes qualite BnF (liste blanche)
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
$qualityAlt = implode('|', $qualitySuffixes);

// Pattern : supprime le suffixe qualite en fin de chaine (avec / multiples)
$qualityPat = '/[.\/]\s*(?:' . $qualityAlt . ')(?:\s*\/\s*(?:' . $qualityAlt . '))*\s*$/iu';

// Marqueur BnF : annee entre parentheses
$hasYearPat   = '/\(\d{4}/u';
// Marqueur BnF : qualite apres un point
$hasQualPat   = '/\.[ \t]*(?:' . $qualityAlt . ')/iu';

// ---------------------------------------------------------------------------
// Fonctions de normalisation
// ---------------------------------------------------------------------------

/**
 * Retire le suffixe qualite et les dates biographiques en fin de chaine.
 * "Ronan (1974-....). Auteur du texte" -> "Ronan"
 */
function stripQuality(string $text, string $qualityPat): string
{
    $text = preg_replace($qualityPat, '', $text);
    // Dates entre parentheses en fin (ex : "(1622-1673)", "(0330?-0390?)")
    $text = preg_replace('/\s*\([^)]*\d{2,}[^)]*\)\s*$/u', '', $text);
    // Point final residuel
    $text = preg_replace('/\.\s*$/u', '', $text);
    return trim($text);
}

/**
 * Vrai si l'element contient un marqueur BnF (annee ou qualite).
 */
function isBnfElement(string $elem, string $hasYearPat, string $hasQualPat): bool
{
    return preg_match($hasYearPat, $elem) || preg_match($hasQualPat, $elem);
}

/**
 * Normalise un tableau d'auteurs BnF bruts.
 * ["Cheneau", "Ronan (1974-....). Auteur du texte"] -> ["Ronan Cheneau"]
 */
function normalizeBnfAuthors(array $authors, string $qualityPat, string $hasYearPat, string $hasQualPat): array
{
    $out = [];
    $n   = count($authors);
    $i   = 0;

    while ($i < $n) {
        $elem     = trim((string) $authors[$i]);
        $nextElem = ($i + 1 < $n) ? trim((string) $authors[$i + 1]) : '';

        if ($elem === '') { $i++; continue; }

        $elemIsPlain = !isBnfElement($elem, $hasYearPat, $hasQualPat);
        $nextIsBnf   = $nextElem !== '' && isBnfElement($nextElem, $hasYearPat, $hasQualPat);
        // Heuristique : nom court = <= 3 mots, pas de virgule (pas une collectivite)
        $elemIsShort = count(explode(' ', $elem)) <= 3 && strpos($elem, ',') === false;

        if ($elemIsPlain && $elemIsShort && $nextIsBnf) {
            // Extraire le prenom : texte avant la premiere parenthese
            $prenomRaw = preg_split('/\s*\(/u', $nextElem)[0];
            $prenom    = trim(stripQuality($prenomRaw, $qualityPat), ' .');
            $out[]     = $prenom !== '' ? "{$prenom} {$elem}" : $elem;
            $i += 2; // consomme les deux elements

        } elseif (isBnfElement($elem, $hasYearPat, $hasQualPat)) {
            // Element BnF autonome : "Moliere (1622-1673). Auteur du texte" -> "Moliere"
            $cleaned = stripQuality($elem, $qualityPat);
            if ($cleaned !== '') $out[] = $cleaned;
            $i++;

        } else {
            // Nom simple -> conserve tel quel
            $out[] = $elem;
            $i++;
        }
    }

    return $out;
}

// ---------------------------------------------------------------------------
// Boucle principale
// ---------------------------------------------------------------------------
$total = DB::table('books')
    ->whereNotNull('authors')
    ->where('authors', '!=', '[]')
    ->where('authors', '!=', '')
    ->count();

echo "Livres avec auteurs a traiter : " . number_format($total, 0, ',', ' ') . PHP_EOL;

$backupFh     = null;
$changedCount = 0;
$processed    = 0;
$lastId       = 0;
$start        = microtime(true);

if ($apply) {
    $backupFh = fopen($backupFile, 'w');
    if (!$backupFh) { fwrite(STDERR, "Impossible d'ouvrir le fichier backup : {$backupFile}\n"); exit(1); }
    echo "Backup vers : {$backupFile}" . PHP_EOL . PHP_EOL;
}

do {
    $rows = DB::table('books')
        ->select('id', 'authors')
        ->where('id', '>', $lastId)
        ->whereNotNull('authors')
        ->where('authors', '!=', '[]')
        ->where('authors', '!=', '')
        ->orderBy('id')
        ->limit($chunkSize)
        ->get();

    if ($rows->isEmpty()) break;

    $updates = [];

    foreach ($rows as $row) {
        $authors = json_decode((string) $row->authors, true);
        if (!is_array($authors)) $authors = [];
        $authors = array_values(array_filter(array_map(fn($a) => trim((string) $a), $authors), fn($a) => $a !== ''));
        if ($authors === []) continue;

        $newAuthors = normalizeBnfAuthors($authors, $qualityPat, $hasYearPat, $hasQualPat);

        if ($newAuthors === $authors) continue;

        $changedCount++;
        $updates[] = [
            'id'          => (int) $row->id,
            'old_authors' => $authors,
            'new_authors' => $newAuthors,
        ];
    }

    // Ecriture backup + UPDATE
    if ($updates && $apply) {
        foreach ($updates as $u) {
            fwrite($backupFh, json_encode($u, JSON_UNESCAPED_UNICODE) . "\n");
            DB::table('books')->where('id', $u['id'])->update([
                'authors' => json_encode($u['new_authors'], JSON_UNESCAPED_UNICODE),
            ]);
        }
    } elseif ($updates && $dryRun) {
        foreach (array_slice($updates, 0, 5) as $u) {
            echo PHP_EOL . "  [#{$u['id']}] AVANT : " . json_encode($u['old_authors'], JSON_UNESCAPED_UNICODE) . PHP_EOL;
            echo           "         APRES : " . json_encode($u['new_authors'], JSON_UNESCAPED_UNICODE) . PHP_EOL;
        }
    }

    $lastId    = $rows->last()->id;
    $processed += $rows->count();
    $elapsed   = round(microtime(true) - $start);
    $pct       = $total > 0 ? round($processed / $total * 100, 1) : 0;
    echo "\r  " . str_pad(number_format($processed, 0, ',', ' '), 9)
        . " / " . number_format($total, 0, ',', ' ')
        . " ({$pct}%) | modifies: {$changedCount} [{$elapsed}s]     ";

} while (true);

echo PHP_EOL;

if ($backupFh) fclose($backupFh);

echo PHP_EOL . str_repeat('=', 60) . PHP_EOL;
echo "  Termine" . PHP_EOL;
echo "  Auteurs normalises : {$changedCount}" . PHP_EOL;
if ($apply) {
    echo "  Backup JSONL       : {$backupFile}" . PHP_EOL;
    echo PHP_EOL . "  Prochaine etape : reindexation Meilisearch" . PHP_EOL;
    echo "  -> relancer populate-authors-list-ephemere.php" . PHP_EOL;
}
echo str_repeat('=', 60) . PHP_EOL;
