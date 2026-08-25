<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('profiles', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->unique()
                ->constrained()
                ->cascadeOnDelete();

            $table->string('phone', 10)->nullable();
            $table->foreignId('city_id')->constrained('cities');

            $table->enum('profile_type', [
                'étudiant(e)',
                'passionné(e)',
                'librairie',
            ])->default('passionné(e)');

            $table->enum('subscription_type', [
                'free',
                'pro',
                'premium',
            ])->default('free');

            $table->enum('delivery_option', [
                'oui',
                'non',
                'selon destination',
            ])->default('selon destination');

            $table->string('nickname');
            $table->string('logo')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('profiles');
    }
};
