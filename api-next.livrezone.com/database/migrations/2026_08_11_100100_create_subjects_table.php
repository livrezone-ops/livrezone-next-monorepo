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
        Schema::create('subjects', function (Blueprint $table) {
            $table->id();
            $table->string('code', 60)->unique();
            $table->string('name_fr', 120);
            $table->string('name_ar', 120)->nullable();
            $table->string('family', 80)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('family');
            $table->index('is_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('subjects');
    }
};
