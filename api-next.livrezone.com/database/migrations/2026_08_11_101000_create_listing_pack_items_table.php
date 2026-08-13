<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('listing_pack_items', function (Blueprint $table) {
            $table->id();

            $table->foreignId('pack_listing_id')
                ->constrained('listings')
                ->cascadeOnDelete();

            $table->foreignId('child_listing_id')
                ->constrained('listings')
                ->cascadeOnDelete();

            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['pack_listing_id', 'child_listing_id']);
            $table->index('pack_listing_id');
            $table->index('child_listing_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('listing_pack_items');
    }
};
