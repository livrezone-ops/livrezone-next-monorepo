<?php

namespace Database\Seeders;

use App\Models\ReferralBlacklist;
use App\Models\ReferralReward;
use App\Models\Setting;
use App\Services\Referral\ReferralSettings;
use Illuminate\Database\Seeder;

/**
 * État de départ du programme de parrainage :
 * - réglages par défaut (programme DÉSACTIVÉ : l'admin l'ouvre explicitement) ;
 * - paliers de l'échelle recommandée (modifiables librement depuis l'admin) ;
 * - blacklist de domaines email temporaires.
 *
 * Idempotent : rejouable sans doublon. Usage : php artisan db:seed --class=ReferralSeeder
 */
class ReferralSeeder extends Seeder
{
    public function run(): void
    {
        $settings = app(ReferralSettings::class);
        foreach (ReferralSettings::DEFAULTS as $key => $default) {
            // N'écrase jamais un réglage déjà modifié par l'admin.
            if (Setting::find($key) === null) {
                $settings->set($key, $default);
            }
        }

        $rewards = [
            [
                'name' => 'Premier parrainage',
                'description' => 'Votre première inscription validée vous offre 7 jours de compte Pro.',
                'condition_type' => 'signups',
                'reward_type' => 'pro_days',
                'reward_payload' => ['days' => 7],
                'threshold_value' => 1,
                'unit_cost' => 0,
                'sort_order' => 1,
            ],
            [
                'name' => 'Parrain confirmé',
                'description' => '5 inscriptions validées : 1 mois de compte Pro offert.',
                'condition_type' => 'signups',
                'reward_type' => 'pro_days',
                'reward_payload' => ['days' => 30],
                'threshold_value' => 5,
                'unit_cost' => 0,
                'sort_order' => 2,
            ],
            [
                'name' => 'Parrain expert',
                'description' => '10 inscriptions validées : 3 mois de compte Pro offerts.',
                'condition_type' => 'signups',
                'reward_type' => 'pro_days',
                'reward_payload' => ['days' => 90],
                'threshold_value' => 10,
                'unit_cost' => 0,
                'sort_order' => 3,
            ],
            [
                'name' => 'Bibliophile',
                'description' => '20 inscriptions validées : un livre numérique offert.',
                'condition_type' => 'signups',
                'reward_type' => 'ebook',
                'reward_payload' => ['title' => 'Livre numérique offert'],
                'threshold_value' => 20,
                'unit_cost' => 10,
                'sort_order' => 4,
            ],
            [
                'name' => 'Ambassadeur',
                'description' => '50 inscriptions validées : -50% sur l\'abonnement annuel.',
                'condition_type' => 'signups',
                'reward_type' => 'percent_discount',
                'reward_payload' => ['percent' => 50, 'scope' => 'yearly'],
                'threshold_value' => 50,
                'unit_cost' => 0,
                'sort_order' => 5,
            ],
            [
                'name' => 'Légende',
                'description' => '100 inscriptions validées : un livre physique offert.',
                'condition_type' => 'signups',
                'reward_type' => 'physical_book',
                'reward_payload' => ['title' => 'Livre physique offert'],
                'threshold_value' => 100,
                'unit_cost' => 150,
                'sort_order' => 6,
            ],
        ];

        foreach ($rewards as $reward) {
            ReferralReward::firstOrCreate(
                ['name' => $reward['name']],
                $reward + ['repeatable' => false, 'max_grants_per_user' => null, 'is_active' => true]
            );
        }

        foreach ($this->disposableEmailDomains() as $domain) {
            ReferralBlacklist::firstOrCreate(
                ['type' => ReferralBlacklist::TYPE_EMAIL_DOMAIN, 'value' => $domain],
                ['reason' => 'Domaine email temporaire']
            );
        }
    }

    /**
     * Domaines email jetables courants (liste statique, sans dépendance
     * externe — complétée par l'admin depuis le menu anti-abus).
     *
     * @return string[]
     */
    private function disposableEmailDomains(): array
    {
        return [
            'mailinator.com', 'yopmail.com', 'yopmail.fr', 'guerrillamail.com',
            'guerrillamail.info', '10minutemail.com', '10minutemail.net',
            'tempmail.com', 'temp-mail.org', 'temp-mail.io', 'throwawaymail.com',
            'sharklasers.com', 'grr.la', 'getnada.com', 'dispostable.com',
            'maildrop.cc', 'mailnesia.com', 'trashmail.com', 'trashmail.de',
            'fakeinbox.com', 'mailcatch.com', 'mytemp.email', 'tempinbox.com',
            'spam4.me', 'mailsac.com', 'inboxbear.com', 'emailondeck.com',
            'mohmal.com', 'linshiyouxiang.net', 'vomoto.com', 'instantemailaddress.com',
        ];
    }
}
