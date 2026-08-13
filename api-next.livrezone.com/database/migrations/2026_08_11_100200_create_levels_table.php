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
        Schema::create('levels', function (Blueprint $table) {
            $table->id();
            $table->string('code', 40)->unique();
            $table->string('name_fr', 80);

            $table->enum('cycle', [
                'primaire',
                'college',
                'lycee',
                'universitaire',
                'professionnel',
                'autre',
            ]);

            $table->unsignedSmallInteger('rank')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('cycle');
            $table->index('rank');
            $table->index('is_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('levels');
    }
};
