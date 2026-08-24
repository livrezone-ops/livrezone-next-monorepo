<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Ajoute les champs de liaison Telegram (token temporaire + horodatages).
     * Idempotent : ne touche que les colonnes manquantes.
     */
    public function up(): void
    {
        Schema::table('profiles', function (Blueprint $table) {
            if (! Schema::hasColumn('profiles', 'telegram_link_token')) {
                $table->string('telegram_link_token')->nullable()->unique();
            }
            if (! Schema::hasColumn('profiles', 'telegram_link_token_expires_at')) {
                $table->timestamp('telegram_link_token_expires_at')->nullable();
            }
            if (! Schema::hasColumn('profiles', 'telegram_linked_at')) {
                $table->timestamp('telegram_linked_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('profiles', function (Blueprint $table) {
            $table->dropColumn([
                'telegram_link_token',
                'telegram_link_token_expires_at',
                'telegram_linked_at',
            ]);
        });
    }
};
