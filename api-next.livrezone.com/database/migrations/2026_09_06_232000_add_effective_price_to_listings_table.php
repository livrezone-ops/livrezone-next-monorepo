<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Colonne générée effective_price (audit #3, 06/09) : COALESCE(discount_price,
     * price) calculé en base et indexable — les filtres/tri/min-max prix publics
     * utilisaient des expressions non indexables (full scan à chaque recherche).
     * Index (status, effective_price) : le statut précède toujours les filtres prix.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('listings', 'effective_price')) {
            Schema::table('listings', function (Blueprint $table) {
                $table->decimal('effective_price', 10, 2)->nullable()
                    ->storedAs('COALESCE(discount_price, price)');
            });
        }

        if (! Schema::hasIndex('listings', 'listings_status_effective_price_index')) {
            Schema::table('listings', function (Blueprint $table) {
                $table->index(['status', 'effective_price']);
            });
        }
    }

    public function down(): void
    {
        Schema::table('listings', function (Blueprint $table) {
            $table->dropIndex(['status', 'effective_price']);
            $table->dropColumn('effective_price');
        });
    }
};
