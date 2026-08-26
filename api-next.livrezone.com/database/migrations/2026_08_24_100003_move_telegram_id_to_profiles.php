<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Déplace telegram_id de la table users vers profiles.
     * Idempotent : fonctionne que la colonne soit déjà sur users, sur profiles,
     * ou les deux.
     */
    public function up(): void
    {
        if (Schema::hasTable('profiles') && ! Schema::hasColumn('profiles', 'telegram_id')) {
            Schema::table('profiles', function (Blueprint $table) {
                $table->string('telegram_id')->nullable()->after('phone');
            });
        }

        if (Schema::hasTable('users') && Schema::hasColumn('users', 'telegram_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('telegram_id');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('users') && ! Schema::hasColumn('users', 'telegram_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('telegram_id')->nullable()->after('avatar');
            });
        }

        if (Schema::hasTable('profiles') && Schema::hasColumn('profiles', 'telegram_id')) {
            Schema::table('profiles', function (Blueprint $table) {
                $table->dropColumn('telegram_id');
            });
        }
    }
};
