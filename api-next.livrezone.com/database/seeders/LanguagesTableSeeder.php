<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class LanguagesTableSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        $languages = [
            ['code' => 'ar', 'name_fr' => 'Arabe', 'name_ar' => 'العربية', 'is_active' => true],
            ['code' => 'fr', 'name_fr' => 'Français', 'name_ar' => 'الفرنسية', 'is_active' => true],
            ['code' => 'en', 'name_fr' => 'Anglais', 'name_ar' => 'الإنجليزية', 'is_active' => true],
            ['code' => 'es', 'name_fr' => 'Espagnol', 'name_ar' => 'الإسبانية', 'is_active' => true],
            ['code' => 'ber', 'name_fr' => 'Berbère / Amazigh', 'name_ar' => 'الأمازيغية', 'is_active' => true],
            ['code' => 'autre', 'name_fr' => 'Autre', 'name_ar' => 'أخرى', 'is_active' => true],
        ];

        foreach ($languages as $language) {
            DB::table('languages')->updateOrInsert(
                ['code' => $language['code']],
                [
                    'name_fr' => $language['name_fr'],
                    'name_ar' => $language['name_ar'],
                    'is_active' => $language['is_active'],
                    'updated_at' => $now,
                    'created_at' => $now,
                ]
            );
        }
    }
}
