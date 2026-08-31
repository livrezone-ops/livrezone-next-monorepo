<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Épinglage et masquage des notifications in-app :
 * - pinned_at : notification épinglée en tête de liste (bouton « Épingler ») ;
 * - dismissed_at : notification masquée par l'utilisateur (bouton « Masquer »),
 *   exclue de la liste et du compteur de non-lues sans être supprimée.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->timestamp('pinned_at')->nullable()->after('read_at');
            $table->timestamp('dismissed_at')->nullable()->after('pinned_at');
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropColumn(['pinned_at', 'dismissed_at']);
        });
    }
};
