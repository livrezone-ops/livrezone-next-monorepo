<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CategoryLevelTableSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        $schoolLevels = [
            'PRESCOLAIRE', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6',
            '1AC', '2AC', '3AC', 'TRONC_COMMUN', '1BAC', '2BAC',
        ];

        $uniLevels = ['LICENCE', 'MASTER', 'DOCTORAT', 'FORMATION_PRO'];

        $categoryLevels = [
            // Scolaire
            'SCOLAIRE' => $schoolLevels,
            'MANUELS_SCOLAIRES' => $schoolLevels,
            'CAHIERS_EXERCICES' => $schoolLevels,
            'EXAMENS_CONCOURS' => $schoolLevels,
            'MATERIEL_EDUCATIF' => $schoolLevels,
            'HISTOIRES_EDUCATIVES' => $schoolLevels,

            // Universitaire et professionnel
            'UNIVERSITAIRE' => $uniLevels,
            'SCIENCES_TECHNO' => $uniLevels,
            'U_INFO' => $uniLevels,
            'MEDECINE_SANTE' => $uniLevels,
            'ECONOMIE_GESTION' => $uniLevels,
            'DROIT' => $uniLevels,
            'SCIENCES_HUMAINES' => $uniLevels,
            'FORMATION_PRO' => $uniLevels,

            // Littérature
            'LITTERATURE' => ['NON_APPLICABLE'],
            'ROMANS' => ['NON_APPLICABLE'],
            'POESIE_THEATRE' => ['NON_APPLICABLE'],
            'ESSAIS_BIOGRAPHIES' => ['NON_APPLICABLE'],
            'BD' => ['NON_APPLICABLE'],
            'MANGAS' => ['NON_APPLICABLE'],

            // Jeunesse
            'JEUNESSE' => ['NON_APPLICABLE'],
            'PETITE_ENFANCE' => ['NON_APPLICABLE'],
            'HISTOIRES_CONTES' => ['NON_APPLICABLE'],
            'PREMIERES_LECTURES' => ['NON_APPLICABLE'],
            'ROMANS_JEUNESSE' => ['NON_APPLICABLE'],
            'ACTIVITES_COLORIAGE' => ['NON_APPLICABLE'],

            // Religion
            'RELIGION' => ['NON_APPLICABLE'],
            'QURAN' => ['NON_APPLICABLE'],
            'HADITH' => ['NON_APPLICABLE'],
            'FIQH' => ['NON_APPLICABLE'],
            'SIRA' => ['NON_APPLICABLE'],
            'SPIRITUALITE' => ['NON_APPLICABLE'],
            'R_AUTRES' => ['NON_APPLICABLE'],

            // Vie pratique
            'VIE_PRATIQUE' => ['NON_APPLICABLE'],
            'DEV_PERSO' => ['NON_APPLICABLE'],
            'CUISINE_MAISON' => ['NON_APPLICABLE'],
            'ARTS_CULTURE' => ['NON_APPLICABLE'],
            'SPORT_LOISIRS' => ['NON_APPLICABLE'],
            'VOYAGE' => ['NON_APPLICABLE'],
            'VP_DIVERS' => ['NON_APPLICABLE'],
        ];

        $categoryIds = DB::table('categories')->pluck('id', 'code');
        $levelIds = DB::table('levels')->pluck('id', 'code');

        foreach ($categoryLevels as $categoryCode => $levels) {
            $categoryId = $categoryIds[$categoryCode] ?? null;

            if (! $categoryId) {
                continue;
            }

            foreach ($levels as $levelCode) {
                $levelId = $levelIds[$levelCode] ?? null;

                if (! $levelId) {
                    continue;
                }

                DB::table('category_level')->updateOrInsert(
                    [
                        'category_id' => $categoryId,
                        'level_id' => $levelId,
                    ],
                    [
                        'updated_at' => $now,
                        'created_at' => $now,
                    ]
                );
            }
        }
    }
}
