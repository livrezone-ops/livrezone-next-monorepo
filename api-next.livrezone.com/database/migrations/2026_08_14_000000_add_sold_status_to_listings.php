<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Étend l'ENUM de la colonne `status` pour inclure tous les statuts
     * utilisés par l'application (dont `sold` manquant).
     */
    public function up(): void
    {
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
        // Rétablit l'ENUM d'origine (sans les nouveaux statuts)
        DB::statement("ALTER TABLE `listings` MODIFY COLUMN `status` ENUM(
            'pending_admin',
            'published',
            'rejected',
            'deleted'
        ) NOT NULL DEFAULT 'pending_admin'");
    }
};
