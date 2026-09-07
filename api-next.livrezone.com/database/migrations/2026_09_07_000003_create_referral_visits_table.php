<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Trafic entrant via les liens de parrainage. RGPD : IP stockée en HMAC,
        // jamais en clair. Lignes immuables (created_at seul), purgées à 90 j par
        // referral:purge-visits — les compteurs agrégés vivent sur users.
        Schema::create('referral_visits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('referrer_user_id')->constrained('users')->cascadeOnDelete();
            // sha256(IP + UA + Accept-Language + sel APP_KEY) : dédoublonnage 24 h
            $table->string('fingerprint_hash', 64);
            $table->string('ip_hash', 64);
            $table->string('user_agent', 512)->nullable();
            $table->string('referer', 512)->nullable();
            $table->string('landing_path', 255)->nullable();
            $table->string('country', 2)->nullable(); // header CF-IPCountry (Cloudflare)
            $table->boolean('is_bot')->default(false);
            // false = non comptée (doublon <24 h, bot, IP blacklistée, cap atteint)
            $table->boolean('counted')->default(true);
            $table->timestamp('created_at');

            $table->index(['referrer_user_id', 'created_at']);
            // Nom d'index explicite : le nom auto-généré dépasse la limite
            // d'identifiants de 64 caractères de MySQL/MariaDB (tests SQLite
            // invisibles à cette contrainte).
            $table->index(['fingerprint_hash', 'referrer_user_id', 'created_at'], 'referral_visits_fp_ref_created_idx');
            $table->index('ip_hash');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('referral_visits');
    }
};
