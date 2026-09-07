<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Blacklists anti-abus (IP, domaines email jetables, fingerprints).
        // Seedée avec les domaines temporaires courants, complétée par l'admin.
        Schema::create('referral_blacklists', function (Blueprint $table) {
            $table->id();
            $table->enum('type', ['ip', 'email_domain', 'fingerprint']);
            $table->string('value', 191);
            $table->string('reason')->nullable();
            $table->timestamps();

            $table->unique(['type', 'value']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('referral_blacklists');
    }
};
