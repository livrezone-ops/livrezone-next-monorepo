<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hero_messages', function (Blueprint $table) {
            $table->id();

            $table->enum('language', ['fr', 'ar']);
            $table->enum('direction', ['ltr', 'rtl']);

            $table->string('title', 255);
            $table->text('description');

            $table->string('primary_action_label', 100);
            $table->string('primary_action_href', 255);

            $table->string('secondary_action_label', 100)->nullable();
            $table->string('secondary_action_href', 255)->nullable();

            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);

            $table->timestamps();

            $table->index(['is_active', 'sort_order']);
            $table->index('language');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hero_messages');
    }
};