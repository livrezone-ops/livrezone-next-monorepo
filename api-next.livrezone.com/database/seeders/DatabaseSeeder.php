<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Garde sécurité (audit 06/09) : ce compte usine a un mot de passe
        // public — un exemplaire avait été semé en prod (neutralisé le 06/09).
        // Ne jamais le recréer hors environnement local.
        if (app()->environment('local', 'testing')) {
            User::factory()->create([
                'name' => 'Test User',
                'email' => 'test@example.com',
            ]);
        }

        $this->call([
            LanguagesTableSeeder::class,
            SubjectsTableSeeder::class,
            LevelsTableSeeder::class,
            CategoriesTableSeeder::class,
            SubjectLevelTableSeeder::class,
            CategorySubjectTableSeeder::class,
            CategoryLevelTableSeeder::class,
            HeroMessagesTableSeeder::class,
        ]);
    }
}
