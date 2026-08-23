<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('notification_preferences');

        Schema::create('notification_preferences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('notification_type'); // e.g. book_orders, newsletter, promos
            $table->string('channel'); // e.g. email, telegram, in_app
            $table->boolean('is_enabled')->default(true);
            $table->json('filters')->nullable(); // Filtres catégories etc.
            $table->timestamps();

            $table->unique(['user_id', 'notification_type', 'channel'], 'user_notif_pref_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_preferences');
    }
};
