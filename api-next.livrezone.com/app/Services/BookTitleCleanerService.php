<?php

namespace App\Services;

use Illuminate\Support\Str;

class BookTitleCleanerService
{
    /**
     * Nettoie un titre en retirant les parasites de notices BNF, mentions de responsabilité
     * et auteurs injectés, tout en CONSERVANT les mentions d'éditions (ex: (2e éd.)).
     *
     * @param string $title
     * @param array|string|null $authors
     * @return string
     */
    public function clean(string $title, mixed $authors = null): string
    {
        $original = trim($title);
        if ($original === '') {
            return '';
        }

        $cleaned = $original;

        // 1. Suppression des balises matérielles MARC / UNIMARC courantes
        $marcNoisePatterns = [
            '/\[\s*Texte\s+imprimé\s*\]/ui',
            '/\[\s*Reproduction\s+en\s+fac-similé\s*\]/ui',
            '/\[\s*Ressource\s+électronique\s*\]/ui',
            '/\[\s*Enregistrement\s+sonore\s*\]/ui',
            '/\[\s*Multimédia\s+multisupport\s*\]/ui',
            '/\[\s*Autocollants?\s*\]/ui',
            '/\[\s*et\s+al\.?\s*\]/ui',
            '/\[\s*texte\s*\]/ui',
        ];
        $cleaned = preg_replace($marcNoisePatterns, '', $cleaned);

        // Nettoyer d'éventuels doubles crochets ou parenthèses vides issus du retrait (ex: "([Reproduction...])" => "")
        $cleaned = preg_replace('/\(\s*\[\s*\]\s*\)/u', '', $cleaned);
        $cleaned = preg_replace('/\(\s*\)/u', '', $cleaned);
        $cleaned = preg_replace('/\[\s*\]/u', '', $cleaned);

        // 2. Suppression des mentions de responsabilité explicites
        $responsibilityPatterns = [
            '/\s*;\s*\[\s*par\s*\]\s+.*$/ui',
            '/\s*;\s*ouvrage\s+coordonné\s+par\s+.*$/ui',
            '/\s*;\s*avec\s+la\s+collaboration\s+de\s+.*$/ui',
            '/\s*;\s*sous\s+la\s+direction\s+(?:scientifique\s+)?de\s+.*$/ui',
            '/\s*;\s*traduit\s+(?:de\s+[^;]+)?par\s+.*$/ui',
            '/\s*;\s*illustr[ée]\s+par\s+.*$/ui',
            '/\s*;\s*photogr(?:aphies)?\s+par\s+.*$/ui',
            '/\s*;\s*pr[ée]face\s+(?:de|par)\s+.*$/ui',
            '/\s*;\s*postface\s+(?:de|par)\s+.*$/ui',
            '/\s*;\s*adaptation\s+(?:de|par)\s+.*$/ui',
            '/\s*;\s*r[ée]vision\s+scientifique\s+.*$/ui',
            // Variantes après parenthèse fermante (ex: "(Nouvelle éd.) sous la direction de...")
            '/\)\s+sous\s+la\s+direction\s+(?:scientifique\s+)?de\s+.*$/ui' => ')',
            '/\)\s+ouvrage\s+coordonné\s+par\s+.*$/ui' => ')',
            '/\)\s+avec\s+la\s+collaboration\s+de\s+.*$/ui' => ')',
            '/\)\s+\[\s*par\s*\]\s+.*$/ui' => ')',
            // Règle générale BNF : tout texte après la mention d'édition "(... éd...)" est la mention d'auteur/responsabilité
            // Ex: "Titre (2e éd.) Auteur Prénom", "Titre (3e éd. revue et augm.) Auteur 1, Auteur 2..."
            '/(\((?:[^\)]*?éd[^\)]*?)\))\s+[A-ZÀ-ÖØ-öø-ÿ].*$/ui' => '$1',
        ];

        foreach ($responsibilityPatterns as $key => $val) {
            if (is_int($key)) {
                $cleaned = preg_replace($val, '', $cleaned);
            } else {
                $cleaned = preg_replace($key, $val, $cleaned);
            }
        }

        // 3. Traitement des suspensions BNF ",..." (ex: "Auteur,..." ou "Auteur Nom,... Co-auteur,...")
        if (str_contains($cleaned, ',...')) {
            // Cas 1 : "Titre (2e éd.) Auteur,..." -> on préserve "(2e éd.)" et on coupe après
            if (preg_match('/^(.*?\((?:[^\)]*?éd[^\)]*?)\))\s+[^\(]+?,\.\.\.?.*$/ui', $cleaned, $m)) {
                $cleaned = $m[1];
            }
            // Cas 2 : "Titre ; Auteur,..." ou "Titre / Auteur,..."
            elseif (preg_match('/^(.*?)\s*[;\/]\s*.*?,\.\.\.?.*$/ui', $cleaned, $m)) {
                $cleaned = $m[1];
            }
            // Cas 3 : "Titre [par] Auteur,..." ou "Titre par Auteur,..."
            elseif (preg_match('/^(.*?)\s*(?:\[\s*par\s*\]|par\s+).*?,\.\.\.?.*$/ui', $cleaned, $m)) {
                $cleaned = $m[1];
            }
            // Cas 4 : "Titre Auteur,..." où l'auteur complet est collé en fin après un titre consistant
            elseif (preg_match('/^(.*?)\s+[A-ZÀ-ÖØ-öø-ÿ][^\s,;]+(?:\s+[A-ZÀ-ÖØ-öø-ÿ][^\s,;]+)*,\.\.\.?.*$/u', $cleaned, $m)) {
                if (mb_strlen(trim($m[1])) >= 4) {
                    $cleaned = $m[1];
                }
            }
            // Sécurité : si ",..." persiste encore en toute fin de chaîne
            $cleaned = preg_replace('/\s*,?\.\.\.?\s*$/u', '', $cleaned);
        }

        // 4. Retrait des auteurs en fin de titre s'ils correspondent aux auteurs en base
        // On itère pour être capable de retirer plusieurs co-auteurs (ex: "(2e éd.) Auteur 1, Auteur 2")
        $authorList = $this->extractAuthorsList($authors);
        $maxAuthorPasses = 5;
        $pass = 0;
        $authorRemoved = true;

        while ($authorRemoved && $pass < $maxAuthorPasses) {
            $authorRemoved = false;
            $pass++;

            foreach ($authorList as $author) {
                $author = trim($author);
                if (mb_strlen($author) < 4) {
                    continue;
                }

                // Ne jamais vider le titre si le titre EST le nom de l'auteur
                if (mb_strtolower($cleaned) === mb_strtolower($author)) {
                    continue;
                }

                $escapedAuthor = preg_quote($author, '/');
                $patterns = [
                    // Strictement après une parenthèse fermante (ex: "(2e éd.) William Berrebi")
                    '/\)\s+' . $escapedAuthor . '(?:\s*,?\.\.\.?)?\s*$/ui' => ')',
                    // Strictement après un point-virgule (ex: "; William Berrebi")
                    '/\s*;\s*' . $escapedAuthor . '(?:\s*,?\.\.\.?)?\s*$/ui' => '',
                    // Strictement après un slash (ex: "/ William Berrebi")
                    '/\s*\/\s*' . $escapedAuthor . '(?:\s*,?\.\.\.?)?\s*$/ui' => '',
                    // Strictement après [par] (ex: "[par] William Berrebi")
                    '/\s*\[\s*par\s*\]\s+' . $escapedAuthor . '(?:\s*,?\.\.\.?)?\s*$/ui' => '',
                ];

                foreach ($patterns as $pattern => $replacement) {
                    if (preg_match($pattern, $cleaned)) {
                        $candidate = preg_replace($pattern, $replacement, $cleaned);
                        $candidateTrimmed = trim($candidate, " \t\n\r\0\x0B,;");

                        // Sécurité : vérifier que le retrait ne laisse pas un mot de liaison orphelin
                        if (preg_match('/\s+(?:et|ou|avec|par|de|d\'|pour|sur|dans|le|la|les|du|des|au|aux)$/ui', $candidateTrimmed)) {
                            continue;
                        }

                        if (mb_strlen($candidateTrimmed) >= 4) {
                            $cleaned = $candidateTrimmed;
                            $authorRemoved = true;
                            break;
                        }
                    }
                }
            }
        }

        // 5. Nettoyage final de la ponctuation résiduelle et des mots de liaison orphelins
        $cleaned = preg_replace('/\s*par\s+(?:le\s+|la\s+)?(?:Dr|Docteur|Prof(?:esseur)?\.?)\.?\s*$/ui', '', $cleaned);
        $cleaned = preg_replace('/\s+(?:par|et|ou|avec|de|d\'|pour|sur|dans|le|la|les|du|des|au|aux)\s*$/ui', '', $cleaned);
        $cleaned = preg_replace('/\s*;\s*$/u', '', $cleaned);
        $cleaned = preg_replace('/\s*:\s*$/u', '', $cleaned);
        $cleaned = preg_replace('/\s*\/\s*$/u', '', $cleaned);
        $cleaned = preg_replace('/\s*-\s*$/u', '', $cleaned);
        $cleaned = preg_replace('/\s*,\s*$/u', '', $cleaned);
        $cleaned = preg_replace('/\s+/u', ' ', $cleaned);
        $cleaned = trim($cleaned);

        // Si le nettoyage a vidé le titre ou l'a trop réduit, on conserve l'original
        if (mb_strlen($cleaned) < 2) {
            return $original;
        }

        return $cleaned;
    }

    /**
     * Normalise un titre (minuscules, sans accents, espaces condensés, max 255 car.)
     * identique au standard de l'application.
     */
    public function normalize(string $title): string
    {
        $normalized = Str::of($title)
            ->ascii()
            ->lower()
            ->replaceMatches('/\s+/u', ' ')
            ->trim();

        return mb_substr((string) $normalized, 0, 255);
    }

    /**
     * Extrait la liste des auteurs sous forme de tableau de chaînes.
     */
    private function extractAuthorsList(mixed $authors): array
    {
        if (empty($authors)) {
            return [];
        }

        if (is_string($authors)) {
            $decoded = json_decode($authors, true);
            if (is_array($decoded)) {
                return $decoded;
            }
            return array_filter(array_map('trim', explode(',', $authors)));
        }

        if (is_array($authors)) {
            return $authors;
        }

        return [];
    }
}
