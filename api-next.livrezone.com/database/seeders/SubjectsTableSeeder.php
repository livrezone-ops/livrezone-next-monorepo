<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SubjectsTableSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        $subjects = [
            ['code' => 'ARABE', 'name_fr' => 'Arabe', 'family' => 'scolaire'],
            ['code' => 'FRANCAIS', 'name_fr' => 'Français', 'family' => 'scolaire'],
            ['code' => 'ANGLAIS', 'name_fr' => 'Anglais', 'family' => 'scolaire'],
            ['code' => 'ESPAGNOL', 'name_fr' => 'Espagnol', 'family' => 'scolaire'],
            ['code' => 'MATHEMATIQUES', 'name_fr' => 'Mathématiques', 'family' => 'commun'],
            ['code' => 'PHYSIQUE_CHIMIE', 'name_fr' => 'Physique-Chimie', 'family' => 'commun'],
            ['code' => 'SVT', 'name_fr' => 'Sciences de la vie et de la Terre', 'family' => 'scolaire'],
            ['code' => 'HISTOIRE_GEO', 'name_fr' => 'Histoire-Géographie', 'family' => 'scolaire'],
            ['code' => 'PHILOSOPHIE', 'name_fr' => 'Philosophie', 'family' => 'scolaire'],
            ['code' => 'INFORMATIQUE', 'name_fr' => 'Informatique', 'family' => 'commun'],
            ['code' => 'RESEAU', 'name_fr' => 'Réseau', 'family' => 'universitaire_professionnel'],
            ['code' => 'DATA_SCIENCE', 'name_fr' => 'Data sciense', 'family' => 'universitaire_professionnel'],
            ['code' => 'BIG_DATA', 'name_fr' => 'Big Data', 'family' => 'universitaire_professionnel'],
            ['code' => 'STATISTIQUE', 'name_fr' => 'Statistique', 'family' => 'universitaire_professionnel'],
            ['code' => 'FINANCE_MARCHES', 'name_fr' => 'finance des marchés', 'family' => 'universitaire_professionnel'],
            ['code' => 'COMPTABILITE', 'name_fr' => 'Comptabilité', 'family' => 'universitaire_professionnel'],
            ['code' => 'AUDIT', 'name_fr' => 'Audit', 'family' => 'universitaire_professionnel'],
            ['code' => 'ECONOMIE_GESTION', 'name_fr' => 'Économie-Gestion', 'family' => 'universitaire_professionnel'],
            ['code' => 'DROIT', 'name_fr' => 'Droit', 'family' => 'universitaire_professionnel'],
            ['code' => 'EDUCATION_ISLAMIQUE', 'name_fr' => 'Éducation islamique', 'family' => 'scolaire'],
            ['code' => 'ARTS', 'name_fr' => 'Arts', 'family' => 'commun'],
            ['code' => 'EPS', 'name_fr' => 'Éducation physique', 'family' => 'scolaire'],
            ['code' => 'MEDECINE_SANTE', 'name_fr' => 'Médecine et santé', 'family' => 'universitaire_professionnel'],
            ['code' => 'SCIENCES_HUMAINES', 'name_fr' => 'Sciences humaines', 'family' => 'universitaire_professionnel'],
            ['code' => 'FORMATION_PRO', 'name_fr' => 'Formation professionnelle', 'family' => 'universitaire_professionnel'],
            ['code' => 'AUTRE', 'name_fr' => 'Autre', 'family' => 'autre'],
            ['code' => 'NON_APPLICABLE', 'name_fr' => 'Non applicable', 'family' => 'autre'],
        ];

        foreach ($subjects as $subject) {
            DB::table('subjects')->updateOrInsert(
                ['code' => $subject['code']],
                [
                    'name_fr' => $subject['name_fr'],
                    'name_ar' => null,
                    'family' => $subject['family'],
                    'is_active' => true,
                    'updated_at' => $now,
                    'created_at' => $now,
                ]
            );
        }
    }
}
