<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Les colonnes de books (default_category_id, language_id, default_level_id)
     * sont déjà indexées via leurs clés étrangères. On ajoute uniquement
     * l'index composite utile sur listings (book_id + status) pour le comptage
     * des annonces, sans créer de doublon.
     */
    public function up(): void
    {
        Schema::table('listings', function (Blueprint $table) {
            if (! Schema::hasIndex('listings', ['book_id', 'status'])) {
                $table->index(['book_id', 'status'], 'listings_book_id_status_idx');
            }
        });
    }

    public function down(): void
    {
        Schema::table('listings', function (Blueprint $table) {
            $table->dropIndex('listings_book_id_status_idx');
        });
    }
};
