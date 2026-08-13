<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SubjectLevelTableSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        $schoolBase = ['ARABE', 'FRANCAIS', 'ANGLAIS', 'ESPAGNOL', 'MATHEMATIQUES', 'ARTS', 'AUTRE'];
        $primaryBase = array_merge($schoolBase, ['EDUCATION_ISLAMIQUE', 'EPS']);
        $middleBase = array_merge($primaryBase, ['SVT', 'HISTOIRE_GEO', 'INFORMATIQUE']);
        $collegeBase = array_merge($middleBase, ['PHYSIQUE_CHIMIE']);
        $lyceeBase = array_merge($collegeBase, ['PHILOSOPHIE']);

        $uniBase = [
            'RESEAU', 'DATA_SCIENCE', 'BIG_DATA', 'STATISTIQUE', 'FINANCE_MARCHES',
            'COMPTABILITE', 'AUDIT', 'ECONOMIE_GESTION', 'DROIT', 'MEDECINE_SANTE',
            'SCIENCES_HUMAINES', 'FORMATION_PRO', 'MATHEMATIQUES', 'PHYSIQUE_CHIMIE',
            'INFORMATIQUE', 'PHILOSOPHIE', 'ARABE', 'FRANCAIS', 'ANGLAIS', 'ESPAGNOL',
            'AUTRE'
        ];

        $proBase = [
            'FORMATION_PRO', 'INFORMATIQUE', 'RESEAU', 'DATA_SCIENCE', 'BIG_DATA',
            'COMPTABILITE', 'AUDIT', 'ECONOMIE_GESTION', 'MEDECINE_SANTE',
            'ARABE', 'FRANCAIS', 'ANGLAIS', 'ESPAGNOL', 'AUTRE'
        ];

        $subjectLevels = [
            'PRESCOLAIRE' => $schoolBase,
            'C1' => $primaryBase,
            'C2' => $primaryBase,
            'C3' => $primaryBase,
            'C4' => $primaryBase,
            'C5' => $primaryBase,
            'C6' => $primaryBase,
            '1AC' => $middleBase,
            '2AC' => $collegeBase,
            '3AC' => $collegeBase,
            'TRONC_COMMUN' => $lyceeBase,
            '1BAC' => $lyceeBase,
            '2BAC' => $lyceeBase,
            'LICENCE' => $uniBase,
            'MASTER' => $uniBase,
            'DOCTORAT' => $uniBase,
            'FORMATION_PRO' => $proBase,
            'NON_APPLICABLE' => ['NON_APPLICABLE'],
        ];

        $subjectIds = DB::table('subjects')->pluck('id', 'code');
        $levelIds = DB::table('levels')->pluck('id', 'code');

        foreach ($subjectLevels as $levelCode => $subjects) {
            $levelId = $levelIds[$levelCode] ?? null;

            if (!$levelId) {
                continue;
            }

            foreach ($subjects as $subjectCode) {
                $subjectId = $subjectIds[$subjectCode] ?? null;

                if (!$subjectId) {
                    continue;
                }

                DB::table('subject_level')->updateOrInsert(
                    [
                        'subject_id' => $subjectId,
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
