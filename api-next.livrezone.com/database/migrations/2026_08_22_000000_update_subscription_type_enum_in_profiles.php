<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Étend l'ENUM subscription_type avec la valeur 'pro'.
     * SQL brut MariaDB/MySQL uniquement : sous SQLite (tests), les ENUM ne sont
     * pas contraintes au niveau du schéma, la migration est donc sans objet.
     */
    public function up(): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            return;
        }

        DB::statement("ALTER TABLE profiles MODIFY COLUMN subscription_type ENUM('free', 'pro', 'premium') DEFAULT 'free'");
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            return;
        }

        DB::table('profiles')->where('subscription_type', 'pro')->update(['subscription_type' => 'free']);
        DB::statement("ALTER TABLE profiles MODIFY COLUMN subscription_type ENUM('free', 'premium') DEFAULT 'free'");
    }
};
