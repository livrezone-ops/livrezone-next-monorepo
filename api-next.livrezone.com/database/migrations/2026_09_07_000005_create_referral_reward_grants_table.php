<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Registre des récompenses accordées (ledger). L'idempotence est portée
        // par le service (transaction + lockForUpdate sur le parrain) ; l'index
        // unique ci-dessous protège les paliers à déclencheur inscription contre
        // un double crédit via la même inscription (rejeu de job).
        Schema::create('referral_reward_grants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reward_id')->constrained('referral_rewards')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete(); // le parrain
            $table->foreignId('signup_id')->nullable()->constrained('referral_signups')->nullOnDelete();
            // granted = créditée (Pro/coupon) ou à récupérer (ebook) ;
            // delivered = remise (livre expédié, cadeau) ;
            // cancelled = retirée par l'admin (fraude avérée).
            $table->enum('status', ['granted', 'delivered', 'cancelled'])->default('granted');
            // Ce qui a été livré : {code, discount_code_id} | {days} |
            // {download_count} | {address:{...}}
            $table->json('delivery')->nullable();
            $table->timestamp('granted_at');
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();

            $table->unique(['reward_id', 'user_id', 'signup_id']);
            $table->index(['user_id', 'granted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('referral_reward_grants');
    }
};
