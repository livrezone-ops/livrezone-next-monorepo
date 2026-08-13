<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class LevelsTableSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        $levels = [
            ['code' => 'PRESCOLAIRE', 'name_fr' => 'Préscolaire', 'cycle' => 'primaire', 'rank' => 5],
            ['code' => 'C1', 'name_fr' => 'C1', 'cycle' => 'primaire', 'rank' => 10],
            ['code' => 'C2', 'name_fr' => 'C2', 'cycle' => 'primaire', 'rank' => 20],
            ['code' => 'C3', 'name_fr' => 'C3', 'cycle' => 'primaire', 'rank' => 30],
            ['code' => 'C4', 'name_fr' => 'C4', 'cycle' => 'primaire', 'rank' => 40],
            ['code' => 'C5', 'name_fr' => 'C5', 'cycle' => 'primaire', 'rank' => 50],
            ['code' => 'C6', 'name_fr' => 'C6', 'cycle' => 'primaire', 'rank' => 60],
            ['code' => '1AC', 'name_fr' => '1AC', 'cycle' => 'college', 'rank' => 110],
            ['code' => '2AC', 'name_fr' => '2AC', 'cycle' => 'college', 'rank' => 120],
            ['code' => '3AC', 'name_fr' => '3AC', 'cycle' => 'college', 'rank' => 130],
            ['code' => 'TRONC_COMMUN', 'name_fr' => 'Tronc commun', 'cycle' => 'lycee', 'rank' => 210],
            ['code' => '1BAC', 'name_fr' => '1re année BAC', 'cycle' => 'lycee', 'rank' => 220],
            ['code' => '2BAC', 'name_fr' => '2e année BAC', 'cycle' => 'lycee', 'rank' => 230],
            ['code' => 'LICENCE', 'name_fr' => 'Supérieur - Licence', 'cycle' => 'universitaire', 'rank' => 310],
            ['code' => 'MASTER', 'name_fr' => 'Supérieur - Master', 'cycle' => 'universitaire', 'rank' => 320],
            ['code' => 'DOCTORAT', 'name_fr' => 'Supérieur - Doctorat', 'cycle' => 'universitaire', 'rank' => 330],
            ['code' => 'FORMATION_PRO', 'name_fr' => 'Formation professionnelle', 'cycle' => 'professionnel', 'rank' => 400],
            ['code' => 'NON_APPLICABLE', 'name_fr' => 'Non applicable', 'cycle' => 'autre', 'rank' => 500],
        ];

        foreach ($levels as $level) {
            DB::table('levels')->updateOrInsert(
                ['code' => $level['code']],
                [
                    'name_fr' => $level['name_fr'],
                    'cycle' => $level['cycle'],
                    'rank' => $level['rank'],
                    'is_active' => true,
                    'updated_at' => $now,
                    'created_at' => $now,
                ]
            );
        }
    }
}
