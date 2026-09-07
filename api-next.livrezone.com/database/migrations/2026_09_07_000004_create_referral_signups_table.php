<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Attribution filleul → parrain. unique(filleul_user_id) au niveau DB :
        // un utilisateur n'a qu'UN parrain, à vie, quel que soit le nombre de
        // cookies/onglets. pending → valid (email vérifié) | invalid (fraude).
        Schema::create('referral_signups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('referrer_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('filleul_user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->enum('status', ['pending', 'valid', 'invalid'])->default('pending');
            // temp_email, blacklist_ip, blacklist_email_domain, self_referral,
            // duplicate_fingerprint, cap_signups_daily…
            $table->string('invalid_reason', 64)->nullable();
            $table->string('ip_hash', 64)->nullable();
            $table->string('fingerprint_hash', 64)->nullable();
            $table->timestamp('valid_at')->nullable();
            $table->timestamps();

            $table->index(['referrer_user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('referral_signups');
    }
};
