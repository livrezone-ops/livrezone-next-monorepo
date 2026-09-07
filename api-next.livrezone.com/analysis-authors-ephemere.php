<?php
/*
 * Éphémère : analyse de la colonne authors de la table books.
 * Classifie les formats, détecte les mélanges titre/auteur, produit des stats.
 * À SUPPRIMER après exécution.
 */
require '/var/www/html/api-next.livrezone.com/vendor/autoload.php';
$app = require '/var/www/html/api-next.livrezone.com/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

$stats = [
    'books_total' => 0,
    'books_no_authors' => 0,       // NULL, [] ou chaînes vides
    'arrays_len_1' => 0,
    'arrays_len_2' => 0,
    'arrays_len_3plus' => 0,
];
$flags = [
    'bnf_structured' => 0,        // ["Nom","Prénom (dates). Auteur du texte"]
    'bnf_with_quality_suffix' => 0,
    'simple_names' => 0,          // ["George R. R. Martin"]
    'empty_elements' => 0,        // éléments vides / espaces
    'elem_contains_colon' => 0,   // élément contenant " : " → titre probable
    'elem_long_80' => 0,          // élément > 80 caractères
    'elem_isbn_like' => 0,        // élément numérique / ISBN
    'elem_contains_by' => 0,      // "Title by Author"
    'elem_equals_title' => 0,     // élément == titre du livre
    'elem_contains_title' => 0,   // titre contenu dans l'élément auteur
    'title_contains_author' => 0, // titre finissant par le nom d'auteur (cas 5659)
    'authors_bool_or_junk' => 0,  // éléments non-string (bool, int...)
];
$examples = [];
$authorCounts = [];   // pour top auteurs (nettoyage minimal)
$sourceCounts = [];

$remember = function (string $key, int $bookId, string $title, string $detail) use (&$examples) {
    if (count($examples[$key] ?? []) < 12) {
        $examples[$key][] = sprintf('#%d | %s | %s', $bookId, mb_substr($title, 0, 70), $detail);
    }
};

$normalizeBnf = function (array $authors): array {
    // ["Nom","Prénom (dates). Auteur du texte"] -> "Prénom Nom"
    $out = [];
    $n = count($authors);
    for ($i = 0; $i < $n; $i++) {
        $a = trim((string) $authors[$i]);
        if ($a === '') continue;
        $next = ($i + 1 < $n) ? trim((string) $authors[$i + 1]) : '';
        // l'élément suivant est un prénom+qualité si : ne ressemble pas à un nom simple seul
        if ($next !== '' && preg_match('/^[^(]*\(\d{4}/u', $next) && !preg_match('/^[A-ZÀ-Ý][\p{L}]+$/u', $next)) {
            // prénom = texte avant " (dates)"
            $prenom = trim(preg_split('/\s*\(/u', $next)[0]);
            $prenom = preg_replace('/\.\s*(Auteur|Autrice|Contributeur|Directeur|Éditeur|Editeur|Traducteur|Illustrateur)[^.]*$/u', '', $prenom);
            $prenom = trim(preg_replace('/[\/\.]\s*$/u', '', $prenom));
            $out[] = trim($prenom . ' ' . $a);
            $i++; // consomme l'élément suivant
        } else {
            $out[] = $a;
        }
    }
    return $out;
};

DB::table('books')
    ->select('id', 'title', 'authors', 'metadata_source')
    ->orderBy('id')
    ->chunk(10000, function ($books) use (&$stats, &$flags, &$examples, &$authorCounts, &$sourceCounts, $remember, $normalizeBnf) {
        foreach ($books as $b) {
            $stats['books_total']++;
            if (!empty($b->metadata_source)) $sourceCounts[$b->metadata_source] = ($sourceCounts[$b->metadata_source] ?? 0) + 1;

            $authors = json_decode((string) $b->authors, true);
            if (!is_array($authors)) $authors = [];
            $authors = array_values(array_filter($authors, fn ($x) => is_string($x) && trim($x) !== ''));
            if ($authors === []) { $stats['books_no_authors']++; continue; }

            $n = count($authors);
            if ($n === 1) $stats['arrays_len_1']++;
            elseif ($n === 2) $stats['arrays_len_2']++;
            else $stats['arrays_len_3plus']++;

            $isBnfStructured = false;
            $allSimple = true;
            $cleaned = [];

            foreach ($authors as $i => $a) {
                $a = trim($a);
                if ($a === '') { $flags['empty_elements']++; continue; }

                if (!is_string($a)) { $flags['authors_bool_or_junk']++; continue; }

                if (preg_match('/\(\d{4}[^)]*\)\.\s*(Auteur|Autrice|Contributeur|Directeur|Éditeur|Editeur|Traducteur|Illustrateur|Préfacier|Postfacier|Annotateur|Collaborateur|Responsable|Directeur)/u', $a)
                    || preg_match('/\.\s*(Auteur|Autrice) du texte/u', $a)) {
                    $flags['bnf_with_quality_suffix']++;
                    $isBnfStructured = true;
                    $allSimple = false;
                } elseif (mb_strlen($a) < 60 && !preg_match('/[:;]/u', $a)) {
                    // nom simple (probable) — mais en BnF structuré, élément "Nom" seul
                } else {
                    $allSimple = false;
                }

                // Détections de mélange titre/auteur
                if (preg_match('/\s[:;]\s/u', $a) && mb_strlen($a) > 25) {
                    $flags['elem_contains_colon']++;
                    $remember('elem_contains_colon', $b->id, $b->title, $a);
                }
                if (mb_strlen($a) > 80) {
                    $flags['elem_long_80']++;
                    $remember('elem_long_80', $b->id, $b->title, $a);
                }
                if (preg_match('/^(97[89][\d\-]{10,}|[\d]{9,13}[\dX])$/u', $a)) {
                    $flags['elem_isbn_like']++;
                    $remember('elem_isbn_like', $b->id, $b->title, $a);
                }
                if (preg_match('/\bby\b/u', $a) && mb_strlen($a) > 20) {
                    $flags['elem_contains_by']++;
                    $remember('elem_contains_by', $b->id, $b->title, $a);
                }

                $tNorm = trim(mb_strtolower(preg_replace('/\s+/u', ' ', (string) $b->title)));
                $aNorm = mb_strtolower(preg_replace('/\s+/u', ' ', $a));
                if ($aNorm !== '' && $aNorm === $tNorm) {
                    $flags['elem_equals_title']++;
                    $remember('elem_equals_title', $b->id, $b->title, $a);
                } elseif (mb_strlen($tNorm) > 20 && $tNorm !== '' && str_contains($tNorm, $aNorm) && $aNorm !== '') {
                    $flags['elem_contains_title']++;
                    $remember('elem_contains_title', $b->id, $b->title, $a);
                }

                $cleaned[] = $a;
            }

            if ($isBnfStructured) $flags['bnf_structured']++;
            elseif ($allSimple && $cleaned !== []) $flags['simple_names']++;

            // Titre finissant par un nom d'auteur (cas #5659) : titre contient le prénom
            foreach ($cleaned as $a) {
                // "Nom","Prénom (dates)" -> "Prénom Nom"
                $full = null;
                $tNorm = trim(mb_strtolower(preg_replace('/\s+/u', ' ', (string) $b->title)));
                if (preg_match('/^([^(]+)\((\d{4})[^)]*\)/u', $a, $m)) {
                    $full = trim(mb_strtolower(trim($m[1]) . ' ' . trim($m[2])));
                } else {
                    $full = mb_strtolower(preg_replace('/\s+/u', ' ', $a));
                }
                if ($full !== '' && mb_strlen($tNorm) > 15 && str_contains($tNorm, $full)) {
                    $flags['title_contains_author']++;
                    $remember('title_contains_author', $b->id, $b->title, implode(' | ', $cleaned));
                    break;
                }
            }

            // Top auteurs sur nettoyage minimal (BnF -> "Prénom Nom")
            foreach ($normalizeBnf($cleaned) as $name) {
                $name = trim($name);
                if ($name === '' || mb_strlen($name) > 80) continue;
                $authorCounts[$name] = ($authorCounts[$name] ?? 0) + 1;
            }
        }
    });

echo "=== STATS GLOBALES ===" . PHP_EOL;
foreach ($stats as $k => $v) echo str_pad($k, 28) . $v . PHP_EOL;
echo PHP_EOL . "=== CLASSIFICATION ===" . PHP_EOL;
foreach ($flags as $k => $v) echo str_pad($k, 28) . $v . PHP_EOL;
echo PHP_EOL . "=== metadata_source ===" . PHP_EOL;
arsort($sourceCounts);
foreach ($sourceCounts as $k => $v) echo str_pad($k, 28) . $v . PHP_EOL;

echo PHP_EOL . "=== TOP 40 AUTEURS (nettoyage minimal) ===" . PHP_EOL;
arsort($authorCounts);
$i = 0;
foreach ($authorCounts as $name => $c) { echo str_pad((string) $c, 6) . $name . PHP_EOL; if (++$i >= 40) break; }
echo 'Distinct auteurs: ' . count($authorCounts) . PHP_EOL;

foreach ($examples as $key => $list) {
    echo PHP_EOL . "=== EXEMPLES : $key ===" . PHP_EOL;
    foreach ($list as $e) echo $e . PHP_EOL;
}
