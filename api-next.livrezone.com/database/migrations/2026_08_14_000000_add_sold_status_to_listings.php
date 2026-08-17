<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Étend l'ENUM de la colonne `status` pour inclure tous les statuts
     * utilisés par l'application (dont `sold` manquant).
     *
     * No-op sur SQLite (utilisé par les tests) : la syntaxe MODIFY COLUMN est
     * spécifique à MySQL/MariaDB et SQLite n'impose pas de contrainte ENUM.
     */
    public function up(): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            return;
        }

        DB::statement("ALTER TABLE `listings` MODIFY COLUMN `status` ENUM(
            'pending_admin',
            'published',
            'rejected',
            'deleted',
            'sold',
            'active',
            'archived',
            'hidden',
            'expired'
        ) NOT NULL DEFAULT 'pending_admin'");
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            return;
        }

        // Rétablit l'ENUM d'origine (sans les nouveaux statuts)
        DB::statement("ALTER TABLE `listings` MODIFY COLUMN `status` ENUM(
            'pending_admin',
            'published',
            'rejected',
            'deleted'
        ) NOT NULL DEFAULT 'pending_admin'");
    }
};
