<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CategorySubjectTableSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        $schoolSubjects = [
            'ARABE', 'FRANCAIS', 'ANGLAIS', 'ESPAGNOL', 'MATHEMATIQUES',
            'PHYSIQUE_CHIMIE', 'SVT', 'HISTOIRE_GEO', 'PHILOSOPHIE',
            'INFORMATIQUE', 'EDUCATION_ISLAMIQUE', 'ARTS', 'EPS', 'AUTRE',
        ];

        $categorySubjects = [
            // Universitaire et professionnel
            'SCIENCES_TECHNO' => ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE', 'SVT', 'AUTRE'],
            'U_INFO' => ['INFORMATIQUE', 'RESEAU', 'DATA_SCIENCE', 'BIG_DATA'],
            'MEDECINE_SANTE' => ['MEDECINE_SANTE'],
            'ECONOMIE_GESTION' => ['ECONOMIE_GESTION', 'FINANCE_MARCHES', 'COMPTABILITE', 'AUDIT'],
            'DROIT' => ['DROIT'],
            'SCIENCES_HUMAINES' => ['SCIENCES_HUMAINES', 'HISTOIRE_GEO', 'PHILOSOPHIE'],
            'FORMATION_PRO' => ['FORMATION_PRO', 'INFORMATIQUE', 'ECONOMIE_GESTION', 'MEDECINE_SANTE', 'AUTRE'],

            // Scolaire
            'MANUELS_SCOLAIRES' => $schoolSubjects,
            'CAHIERS_EXERCICES' => $schoolSubjects,
            'EXAMENS_CONCOURS' => $schoolSubjects,
            'MATERIEL_EDUCATIF' => $schoolSubjects,
            'HISTOIRES_EDUCATIVES' => $schoolSubjects,

            // Littérature
            'ROMANS' => ['NON_APPLICABLE'],
            'POESIE_THEATRE' => ['NON_APPLICABLE'],
            'ESSAIS_BIOGRAPHIES' => ['NON_APPLICABLE'],
            'BD' => ['NON_APPLICABLE'],
            'MANGAS' => ['NON_APPLICABLE'],

            // Jeunesse
            'PETITE_ENFANCE' => ['NON_APPLICABLE'],
            'HISTOIRES_CONTES' => ['NON_APPLICABLE'],
            'PREMIERES_LECTURES' => ['NON_APPLICABLE'],
            'ROMANS_JEUNESSE' => ['NON_APPLICABLE'],
            'ACTIVITES_COLORIAGE' => ['NON_APPLICABLE'],

            // Religion
            'QURAN' => ['NON_APPLICABLE'],
            'HADITH' => ['NON_APPLICABLE'],
            'FIQH' => ['NON_APPLICABLE'],
            'SIRA' => ['NON_APPLICABLE'],
            'SPIRITUALITE' => ['NON_APPLICABLE'],
            'R_AUTRES' => ['NON_APPLICABLE'],

            // Vie pratique
            'DEV_PERSO' => ['NON_APPLICABLE'],
            'CUISINE_MAISON' => ['NON_APPLICABLE'],
            'ARTS_CULTURE' => ['NON_APPLICABLE'],
            'SPORT_LOISIRS' => ['NON_APPLICABLE'],
            'VOYAGE' => ['NON_APPLICABLE'],
            'VP_DIVERS' => ['NON_APPLICABLE'],
        ];

        $categoryIds = DB::table('categories')->pluck('id', 'code');
        $subjectIds = DB::table('subjects')->pluck('id', 'code');

        foreach ($categorySubjects as $categoryCode => $subjects) {
            $categoryId = $categoryIds[$categoryCode] ?? null;

            if (! $categoryId) {
                continue;
            }

            foreach ($subjects as $subjectCode) {
                $subjectId = $subjectIds[$subjectCode] ?? null;

                if (! $subjectId) {
                    continue;
                }

                DB::table('category_subject')->updateOrInsert(
                    [
                        'category_id' => $categoryId,
                        'subject_id' => $subjectId,
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
