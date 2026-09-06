<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Unicités de sécurité/cohérence (audit #9, 06/09) : transaction_id unique
     * pour l'idempotence des webhooks de paiement (un webhook rejoué ne doit
     * jamais créer un second paiement), telegram_id unique sur les profils.
     * 0 doublon vérifié en production avant pose.
     */
    public function up(): void
    {
        if (! Schema::hasIndex('payments', 'payments_transaction_id_unique')) {
            Schema::table('payments', function (Blueprint $table) {
                $table->unique('transaction_id');
            });
        }

        if (! Schema::hasIndex('profiles', 'profiles_telegram_id_unique')) {
            Schema::table('profiles', function (Blueprint $table) {
                $table->unique('telegram_id');
            });
        }
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropUnique(['transaction_id']);
        });

        Schema::table('profiles', function (Blueprint $table) {
            $table->dropUnique(['telegram_id']);
        });
    }
};
