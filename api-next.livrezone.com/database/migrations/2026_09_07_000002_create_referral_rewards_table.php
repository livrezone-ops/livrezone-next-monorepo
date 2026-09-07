<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Les « offres » publiées par l'admin : chaque palier choisit librement
        // sa condition (inscriptions validées OU visites uniques) et son contenu
        // (jours Pro, réduction, coupon, ebook, livre physique, cadeau).
        Schema::create('referral_rewards', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable(); // affichée au parrain
            $table->enum('condition_type', ['signups', 'visits'])->default('signups');
            $table->enum('reward_type', [
                'pro_days',         // accès / prolongation Pro (payload.days)
                'percent_discount', // réduction en % (payload.percent, payload.scope)
                'coupon',           // coupon montant fixe (payload.amount, MAD)
                'ebook',            // livre numérique (payload.title, payload.file_path)
                'premium_ebook',    // ebook premium (idem)
                'physical_book',    // livre physique (adresse à collecter, livraison manuelle)
                'gift',             // cadeau promotionnel (livraison manuelle)
            ]);
            $table->json('reward_payload');
            $table->unsignedInteger('threshold_value');
            // true = accordé à CHAQUE multiple du seuil (ex. tous les 20 signups)
            $table->boolean('repeatable')->default(false);
            $table->unsignedInteger('max_grants_per_user')->nullable();
            // Coût unitaire estimé (MAD) : alimente le « coût estimé du programme »
            // du dashboard admin. Jours Pro : valeur à discretion de l'admin.
            $table->decimal('unit_cost', 8, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['is_active', 'condition_type', 'threshold_value']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('referral_rewards');
    }
};
