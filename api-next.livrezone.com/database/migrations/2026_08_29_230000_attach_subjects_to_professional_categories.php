<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Fix UX signalé le 29/08 : la liste des matières proposées à la création
 * d'annonce était incomplète pour le niveau professionnel — les catégories
 * professionnelles/universitaires n'avaient que 1 à 5 matières alors que la
 * famille `universitaire_professionnel` en contient 15.
 *
 * Attache (sans détachement — aucune donnée supprimée) aux catégories
 * professionnelles/universitaires (#22-#28) l'ensemble des matières actives
 * des familles universitaire_professionnel + commun + AUTRE, plus les 4
 * langues (ARABE, FRANCAIS, ANGLAIS, ESPAGNOL — déjà présentes dans
 * subject_level pour FORMATION_PRO). NON_APPLICABLE reste volontairement
 * exclu (marqueur « matière non applicable »).
 */
return new class extends Migration
{
    /** Catégories professionnelles/universitaires (audience adulte). */
    private const CATEGORY_IDS = [22, 23, 24, 25, 26, 27, 28];

    /** Familles universitaire_professionnel + commun + autre, hors NON_APPLICABLE. */
    private const SUBJECT_IDS = [
        1, 2, 3, 4,                                  // langues (scolaire)
        5, 6, 10, 21,                                // commun
        11, 12, 13, 14, 15, 16, 17, 18, 19, 23, 24, 25, // universitaire_professionnel
        26,                                          // AUTRE
    ];

    public function up(): void
    {
        $now = now();

        // Tolérant aux environnements vides (tests SQLite) : on n'insère que
        // les paires dont les deux extrémités existent réellement.
        $categoryIds = DB::table('categories')->whereIn('id', self::CATEGORY_IDS)->pluck('id');
        $subjectIds = DB::table('subjects')->whereIn('id', self::SUBJECT_IDS)->pluck('id');

        foreach ($categoryIds as $categoryId) {
            foreach ($subjectIds as $subjectId) {
                DB::table('category_subject')->insertOrIgnore([
                    'category_id' => $categoryId,
                    'subject_id' => $subjectId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        DB::table('category_subject')
            ->whereIn('category_id', self::CATEGORY_IDS)
            ->whereIn('subject_id', self::SUBJECT_IDS)
            ->where('created_at', '>=', '2026-08-29 00:00:00')
            ->delete();
    }
};
