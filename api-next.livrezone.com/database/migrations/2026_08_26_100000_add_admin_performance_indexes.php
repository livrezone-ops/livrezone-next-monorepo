<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Index de performance pour l'admin et les requêtes fréquentes :
 * - payments : filtres statut/type, recherche transaction, échéances
 * - orders   : modération et visibilité publique des demandes
 * - notifications : badge non-lus
 * - profiles : filtre par type d'abonnement (admin)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            if (! Schema::hasIndex('payments', 'payments_status_index')) {
                $table->index('status');
            }
            if (! Schema::hasIndex('payments', 'payments_subscription_type_index')) {
                $table->index('subscription_type');
            }
            if (! Schema::hasIndex('payments', 'payments_transaction_id_index')) {
                $table->index('transaction_id');
            }
            if (! Schema::hasIndex('payments', 'payments_expires_at_index')) {
                $table->index('expires_at');
            }
        });

        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasIndex('orders', 'orders_status_index')) {
                $table->index('status');
            }
            if (! Schema::hasIndex('orders', 'orders_status_published_at_index')) {
                $table->index(['status', 'published_at']);
            }
        });

        Schema::table('notifications', function (Blueprint $table) {
            if (! Schema::hasIndex('notifications', 'notifications_read_at_index')) {
                $table->index('read_at');
            }
        });

        Schema::table('profiles', function (Blueprint $table) {
            if (! Schema::hasIndex('profiles', 'profiles_subscription_type_index')) {
                $table->index('subscription_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropIndex(['subscription_type']);
            $table->dropIndex(['transaction_id']);
            $table->dropIndex(['expires_at']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropIndex(['status', 'published_at']);
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex(['read_at']);
        });

        Schema::table('profiles', function (Blueprint $table) {
            $table->dropIndex(['subscription_type']);
        });
    }
};
