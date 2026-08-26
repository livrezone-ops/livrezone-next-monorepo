<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Suppression douce par utilisateur : le fil est masqué pour un participant
     * sans être supprimé pour l'autre.
     */
    public function up(): void
    {
        Schema::table('chat_threads', function (Blueprint $table) {
            $table->timestamp('deleted_for_user_one_at')->nullable()->after('last_message_at');
            $table->timestamp('deleted_for_user_two_at')->nullable()->after('deleted_for_user_one_at');
        });
    }

    public function down(): void
    {
        Schema::table('chat_threads', function (Blueprint $table) {
            $table->dropColumn(['deleted_for_user_one_at', 'deleted_for_user_two_at']);
        });
    }
};
