<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CategoriesTableSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        $categories = [
            // Catégories Parents
            ['code' => 'LITTERATURE', 'name_fr' => 'Littérature', 'slug' => 'litterature', 'parent_code' => null, 'audiences' => ['adulte'], 'sort_order' => 10],
            ['code' => 'JEUNESSE', 'name_fr' => 'Jeunesse', 'slug' => 'jeunesse', 'parent_code' => null, 'audiences' => ['enfant', 'ado'], 'sort_order' => 20],
            ['code' => 'SCOLAIRE', 'name_fr' => 'Scolaire', 'slug' => 'scolaire', 'parent_code' => null, 'audiences' => ['enfant', 'ado'], 'sort_order' => 30],
            ['code' => 'UNIVERSITAIRE', 'name_fr' => 'Universitaire et professionnel', 'slug' => 'universitaire-professionnel', 'parent_code' => null, 'audiences' => ['adulte'], 'sort_order' => 40],
            ['code' => 'RELIGION', 'name_fr' => 'Religion', 'slug' => 'religion', 'parent_code' => null, 'audiences' => ['enfant', 'ado', 'adulte', 'tout_public'], 'sort_order' => 50],
            ['code' => 'VIE_PRATIQUE', 'name_fr' => 'Vie pratique et loisirs', 'slug' => 'vie-pratique-loisirs', 'parent_code' => null, 'audiences' => ['tout_public'], 'sort_order' => 60],

            // Sous-catégories Littérature
            ['code' => 'ROMANS', 'name_fr' => 'Romans', 'slug' => 'litterature/romans', 'parent_code' => 'LITTERATURE', 'audiences' => ['adulte'], 'sort_order' => 11],
            ['code' => 'POESIE_THEATRE', 'name_fr' => 'Poésie et théâtre', 'slug' => 'litterature/poesie-theatre', 'parent_code' => 'LITTERATURE', 'audiences' => ['adulte'], 'sort_order' => 12],
            ['code' => 'ESSAIS_BIOGRAPHIES', 'name_fr' => 'Essais et biographies', 'slug' => 'litterature/essais-biographies', 'parent_code' => 'LITTERATURE', 'audiences' => ['adulte'], 'sort_order' => 13],
            ['code' => 'BD', 'name_fr' => 'BD', 'slug' => 'litterature/bd', 'parent_code' => 'LITTERATURE', 'audiences' => ['tout_public'], 'sort_order' => 14],
            ['code' => 'MANGAS', 'name_fr' => 'Mangas', 'slug' => 'litterature/mangas', 'parent_code' => 'LITTERATURE', 'audiences' => ['tout_public'], 'sort_order' => 15],

            // Sous-catégories Jeunesse
            ['code' => 'PETITE_ENFANCE', 'name_fr' => 'Petite enfance', 'slug' => 'jeunesse/petite-enfance', 'parent_code' => 'JEUNESSE', 'audiences' => ['enfant'], 'sort_order' => 21],
            ['code' => 'HISTOIRES_CONTES', 'name_fr' => 'Histoires et contes', 'slug' => 'jeunesse/histoires-contes', 'parent_code' => 'JEUNESSE', 'audiences' => ['enfant', 'ado'], 'sort_order' => 22],
            ['code' => 'PREMIERES_LECTURES', 'name_fr' => 'Premières lectures', 'slug' => 'jeunesse/premieres-lectures', 'parent_code' => 'JEUNESSE', 'audiences' => ['enfant'], 'sort_order' => 23],
            ['code' => 'ROMANS_JEUNESSE', 'name_fr' => 'Romans jeunesse', 'slug' => 'jeunesse/romans-jeunesse', 'parent_code' => 'JEUNESSE', 'audiences' => ['ado'], 'sort_order' => 24],
            ['code' => 'ACTIVITES_COLORIAGE', 'name_fr' => 'Activités et coloriage', 'slug' => 'jeunesse/activites-coloriage', 'parent_code' => 'JEUNESSE', 'audiences' => ['enfant'], 'sort_order' => 25],

            // Sous-catégories Scolaire
            ['code' => 'MANUELS_SCOLAIRES', 'name_fr' => 'Manuels scolaires', 'slug' => 'scolaire/manuels-scolaires', 'parent_code' => 'SCOLAIRE', 'audiences' => ['enfant', 'ado'], 'sort_order' => 31],
            ['code' => 'CAHIERS_EXERCICES', 'name_fr' => 'Cahiers et exercices', 'slug' => 'scolaire/cahiers-exercices', 'parent_code' => 'SCOLAIRE', 'audiences' => ['enfant', 'ado'], 'sort_order' => 32],
            ['code' => 'EXAMENS_CONCOURS', 'name_fr' => 'Examens et concours', 'slug' => 'scolaire/examens-concours', 'parent_code' => 'SCOLAIRE', 'audiences' => ['ado'], 'sort_order' => 33],
            ['code' => 'MATERIEL_EDUCATIF', 'name_fr' => 'Matériel éducatif', 'slug' => 'scolaire/materiel-educatif', 'parent_code' => 'SCOLAIRE', 'audiences' => ['enfant', 'ado'], 'sort_order' => 34],
            ['code' => 'HISTOIRES_EDUCATIVES', 'name_fr' => 'Histoires éducatives', 'slug' => 'scolaire/histoires-educatives', 'parent_code' => 'SCOLAIRE', 'audiences' => ['enfant', 'ado'], 'sort_order' => 35],

            // Sous-catégories Universitaire & Professionnel
            ['code' => 'SCIENCES_TECHNO', 'name_fr' => 'Sciences et technologie', 'slug' => 'universitaire-professionnel/sciences-technologie', 'parent_code' => 'UNIVERSITAIRE', 'audiences' => ['adulte'], 'sort_order' => 41],
            ['code' => 'U_INFO', 'name_fr' => 'Informatique', 'slug' => 'universitaire-professionnel/informatique', 'parent_code' => 'UNIVERSITAIRE', 'audiences' => ['adulte'], 'sort_order' => 42],
            ['code' => 'MEDECINE_SANTE', 'name_fr' => 'Médecine et santé', 'slug' => 'universitaire-professionnel/medecine-sante', 'parent_code' => 'UNIVERSITAIRE', 'audiences' => ['adulte'], 'sort_order' => 43],
            ['code' => 'ECONOMIE_GESTION', 'name_fr' => 'Économie et gestion', 'slug' => 'universitaire-professionnel/economie-gestion', 'parent_code' => 'UNIVERSITAIRE', 'audiences' => ['adulte'], 'sort_order' => 44],
            ['code' => 'DROIT', 'name_fr' => 'Droit', 'slug' => 'universitaire-professionnel/droit', 'parent_code' => 'UNIVERSITAIRE', 'audiences' => ['adulte'], 'sort_order' => 45],
            ['code' => 'SCIENCES_HUMAINES', 'name_fr' => 'Sciences humaines', 'slug' => 'universitaire-professionnel/sciences-humaines', 'parent_code' => 'UNIVERSITAIRE', 'audiences' => ['adulte'], 'sort_order' => 46],
            ['code' => 'FORMATION_PRO', 'name_fr' => 'Formation professionnelle', 'slug' => 'universitaire-professionnel/formation-professionnelle', 'parent_code' => 'UNIVERSITAIRE', 'audiences' => ['adulte'], 'sort_order' => 47],

            // Sous-catégories Religion
            ['code' => 'QURAN', 'name_fr' => 'Quran', 'slug' => 'religion/quran', 'parent_code' => 'RELIGION', 'audiences' => ['enfant', 'ado', 'adulte', 'tout_public'], 'sort_order' => 51],
            ['code' => 'HADITH', 'name_fr' => 'Hadith', 'slug' => 'religion/hadith', 'parent_code' => 'RELIGION', 'audiences' => ['adulte'], 'sort_order' => 52],
            ['code' => 'FIQH', 'name_fr' => 'Fiqh', 'slug' => 'religion/fiqh', 'parent_code' => 'RELIGION', 'audiences' => ['adulte'], 'sort_order' => 53],
            ['code' => 'SIRA', 'name_fr' => 'Sira', 'slug' => 'religion/sira', 'parent_code' => 'RELIGION', 'audiences' => ['enfant', 'ado', 'adulte'], 'sort_order' => 54],
            ['code' => 'SPIRITUALITE', 'name_fr' => 'Spiritualité', 'slug' => 'religion/spiritualite', 'parent_code' => 'RELIGION', 'audiences' => ['adulte'], 'sort_order' => 55],
            ['code' => 'R_AUTRES', 'name_fr' => 'Autres', 'slug' => 'religion/autres', 'parent_code' => 'RELIGION', 'audiences' => ['tout_public'], 'sort_order' => 56],

            // Sous-catégories Vie pratique & loisirs
            ['code' => 'DEV_PERSO', 'name_fr' => 'Développement personnel', 'slug' => 'vie-pratique-loisirs/developpement-personnel', 'parent_code' => 'VIE_PRATIQUE', 'audiences' => ['adulte'], 'sort_order' => 61],
            ['code' => 'CUISINE_MAISON', 'name_fr' => 'Cuisine et maison', 'slug' => 'vie-pratique-loisirs/cuisine-maison', 'parent_code' => 'VIE_PRATIQUE', 'audiences' => ['tout_public'], 'sort_order' => 62],
            ['code' => 'ARTS_CULTURE', 'name_fr' => 'Arts et culture', 'slug' => 'vie-pratique-loisirs/arts-culture', 'parent_code' => 'VIE_PRATIQUE', 'audiences' => ['tout_public'], 'sort_order' => 63],
            ['code' => 'SPORT_LOISIRS', 'name_fr' => 'Sport et loisirs', 'slug' => 'vie-pratique-loisirs/sport-loisirs', 'parent_code' => 'VIE_PRATIQUE', 'audiences' => ['tout_public'], 'sort_order' => 64],
            ['code' => 'VOYAGE', 'name_fr' => 'Voyage', 'slug' => 'vie-pratique-loisirs/voyage', 'parent_code' => 'VIE_PRATIQUE', 'audiences' => ['tout_public'], 'sort_order' => 65],
            ['code' => 'VP_DIVERS', 'name_fr' => 'Divers', 'slug' => 'vie-pratique-loisirs/divers', 'parent_code' => 'VIE_PRATIQUE', 'audiences' => ['tout_public'], 'sort_order' => 66],
        ];

        // Étape 1 : Insertion initiale avec parent_id = null
        foreach ($categories as $category) {
            DB::table('categories')->updateOrInsert(
                ['code' => $category['code']],
                [
                    'parent_id' => null,
                    'name_fr' => $category['name_fr'],
                    'name_ar' => null,
                    'slug' => $category['slug'],
                    'audiences' => json_encode($category['audiences']),
                    'is_active' => true,
                    'sort_order' => $category['sort_order'],
                    'updated_at' => $now,
                    'created_at' => $now,
                ]
            );
        }

        // Étape 2 : Résolution et mise à jour des parent_id
        $codeToId = DB::table('categories')->pluck('id', 'code');

        foreach ($categories as $category) {
            if (!$category['parent_code']) {
                continue;
            }

            $parentId = $codeToId[$category['parent_code']] ?? null;

            DB::table('categories')
                ->where('code', $category['code'])
                ->update([
                    'parent_id' => $parentId,
                    'updated_at' => $now
                ]);
        }
    }
}
