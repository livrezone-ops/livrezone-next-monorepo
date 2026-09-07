<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Le parrainage vit sur PROFILES (identité plateforme : telegram_id,
        // abonnement… déjà là), pas sur users (auth). referred_by_id reste un
        // id users : c'est l'utilisateur qui a parrainé.
        Schema::table('profiles', function (Blueprint $table) {
            // Code de parrainage court, alphabet sans ambiguïté (pas de 0/O/1/I).
            // Généré paresseusement au premier usage : les profils existants ne
            // sont pas touchés par la migration. Nullable : MySQL tolère
            // plusieurs NULL dans un index unique.
            $table->string('referral_code', 12)->nullable()->unique()->after('subscription_type');

            // Fige le parrain à l'inscription — premier cookie gagnant, jamais
            // réattribué. nullOnDelete : la suppression du parrain ne casse pas
            // le compte filleul (historique conservé en referral_signups).
            $table->foreignId('referred_by_id')->nullable()->after('referral_code')
                ->constrained('users')->nullOnDelete();

            // Les deux compteurs de parrainage, indexés pour le classement admin
            // (ORDER BY direct). shares = visites uniques comptées via le lien ;
            // signups = inscriptions VALIDÉES uniquement (email vérifié).
            // Incrémentés chacun depuis un seul point du code (TrackingService /
            // RewardService) : jamais depuis un contrôleur.
            $table->unsignedInteger('referral_shares_count')->default(0)->after('referred_by_id')->index();
            $table->unsignedInteger('referral_signups_count')->default(0)->after('referral_shares_count')->index();

            // Exclusion du programme (fraude confirmée par l'admin) : gel des
            // évaluations et du tracking sans toucher au compte lui-même.
            $table->timestamp('referral_blocked_at')->nullable()->after('referral_signups_count');
        });
    }

    public function down(): void
    {
        Schema::table('profiles', function (Blueprint $table) {
            $table->dropForeign(['referred_by_id']);
            $table->dropColumn([
                'referral_code',
                'referred_by_id',
                'referral_shares_count',
                'referral_signups_count',
                'referral_blocked_at',
            ]);
        });
    }
};
