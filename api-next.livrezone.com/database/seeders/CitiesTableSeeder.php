<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CitiesTableSeeder extends Seeder
{
    public function run()
    {
        $path = database_path('seeders/data/villesmaroc.csv');

        if (! file_exists($path)) {
            return;
        }

        if (($handle = fopen($path, 'r')) === false) {
            return;
        }

        while (($row = fgetcsv($handle, 0, ',')) !== false) {
            if (count($row) === 0) {
                continue;
            }

            $name = trim($row[0]);
            $name = preg_replace('/[^\p{L}\p{N}\s-]+$/u', '', $name);
            $name = preg_replace('/\s+/u', ' ', $name);
            $name = mb_convert_case($name, MB_CASE_TITLE, 'UTF-8');

            if ($name === '' || strcasecmp($name, 'name') === 0) {
                continue;
            }

            DB::table('cities')->updateOrInsert(
                ['name' => $name],
                ['updated_at' => now(), 'created_at' => now()]
            );
        }

        fclose($handle);

        DB::table('cities')->updateOrInsert(
            ['name' => 'Autre'],
            ['updated_at' => now(), 'created_at' => now()]
        );
    }
}