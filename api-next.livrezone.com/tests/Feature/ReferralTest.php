<?php

namespace Tests\Feature;

use App\Models\City;
use App\Models\DiscountCode;
use App\Models\Payment;
use App\Models\ReferralBlacklist;
use App\Models\ReferralReward;
use App\Models\ReferralRewardGrant;
use App\Models\ReferralSignup;
use App\Models\ReferralVisit;
use App\Models\User;
use App\Services\Referral\ReferralSettings;
use App\Services\Referral\ReferralTrackingService;
use App\Services\SubscriptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

/**
 * Programme de parrainage : tracking des visites, attribution à l'inscription,
 * validation email (seul déclencheur), paliers inscriptions/visites, caps
 * anti-abus, livraison Pro/coupon et endpoints admin.
 * Le parrainage vit sur PROFILES (code, compteurs, blocage) — pas sur users.
 */
class ReferralTest extends TestCase
{
    use RefreshDatabase;

    private ReferralSettings $settings;

    protected function setUp(): void
    {
        parent::setUp();

        $this->settings = app(ReferralSettings::class);
        Cache::flush();

        // Le .env de prod active Telegram : on intercepte HTTP pour que les
        // alertes admin ne partent jamais vers la vraie API pendant les tests.
        Http::fake([
            'api.telegram.org/*' => Http::response(['ok' => true]),
        ]);

        // Programme actif par défaut dans les tests (l'admin l'active en prod).
        $this->settings->set('referral_enabled', true);
    }

    private function createReferrer(): User
    {
        $user = User::factory()->create();

        // Chaque inscrit obtient un profil (ensureProfileExists) : reproduit ici
        // car le parrainage (code, compteurs, blocage) vit sur profiles.
        $user->profile()->create([
            'city_id' => City::create(['name' => 'Ville-'.$user->id])->id,
            'nickname' => 'parrain-'.$user->id,
        ]);

        return $user->load('profile');
    }

    private function createReward(array $overrides = []): ReferralReward
    {
        return ReferralReward::create(array_merge([
            'name' => 'Palier test',
            'condition_type' => 'signups',
            'reward_type' => 'pro_days',
            'reward_payload' => ['days' => 7],
            'threshold_value' => 1,
            'repeatable' => false,
            'is_active' => true,
            'unit_cost' => 0,
        ], $overrides));
    }

    private function trackVisit(User $referrer, string $ip = '127.0.0.1', string $ua = 'Mozilla/5.0 (test)')
    {
        return $this->withServerVariables(['REMOTE_ADDR' => $ip])
            ->withHeaders(['Accept-Language' => 'fr-FR', 'User-Agent' => $ua])
            ->postJson('/api/referral/track', ['code' => $referrer->profile->referralCode()]);
    }

    /*
     * ------------------------------ Tracking ------------------------------
     */

    public function test_track_counts_unique_visit_and_increments_shares(): void
    {
        $referrer = $this->createReferrer();

        $response = $this->trackVisit($referrer);

        $response->assertOk()->assertJsonPath('counted', true)->assertCookie('lz_ref');
        $this->assertSame(1, $referrer->fresh()->profile->referral_shares_count);
        $this->assertSame(1, ReferralVisit::where('referrer_user_id', $referrer->id)->where('counted', true)->count());
    }

    public function test_track_deduplicates_same_fingerprint_within_24h(): void
    {
        $referrer = $this->createReferrer();

        $this->trackVisit($referrer, '41.92.0.10');
        $this->trackVisit($referrer, '41.92.0.10'); // même fingerprint < 24 h

        $this->assertSame(1, $referrer->fresh()->profile->referral_shares_count);
        $this->assertSame(1, ReferralVisit::where('counted', true)->count());
    }

    public function test_track_does_not_count_bots(): void
    {
        $referrer = $this->createReferrer();

        // UA bot + pas d'Accept-Language → visite non comptée.
        $this->withHeaders(['User-Agent' => 'python-requests/2.31'])
            ->postJson('/api/referral/track', ['code' => $referrer->profile->referralCode()]);

        $this->assertSame(0, $referrer->fresh()->profile->referral_shares_count);
        $this->assertSame(1, ReferralVisit::where('is_bot', true)->count());
    }

    public function test_track_is_ignored_when_program_disabled(): void
    {
        $referrer = $this->createReferrer();
        $this->settings->set('referral_enabled', false);

        $this->trackVisit($referrer)->assertJsonPath('status', 'ignored');

        $this->assertSame(0, ReferralVisit::count());
    }

    public function test_referrer_own_visit_is_never_counted(): void
    {
        $referrer = $this->createReferrer();

        // Le parrain suit son propre lien, connecté.
        $this->actingAs($referrer)->withHeaders(['Accept-Language' => 'fr-FR'])
            ->postJson('/api/referral/track', ['code' => $referrer->profile->referralCode()])
            ->assertJsonPath('status', 'self');

        $this->assertSame(0, $referrer->fresh()->profile->referral_shares_count);
    }

    /*
     * --------------------------- Attribution ---------------------------
     */

    public function test_register_with_ref_cookie_creates_pending_signup(): void
    {
        $referrer = $this->createReferrer();
        $this->trackVisit($referrer);

        $response = $this->withCredentials()->withUnencryptedCookies([
            ReferralTrackingService::COOKIE_NAME => $referrer->fresh()->profile->referral_code,
        ])->postJson('/api/auth/register', [
            'name' => 'Filleul Test',
            'email' => 'filleul@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ]);

        $response->assertCreated();
        $filleul = User::where('email', 'filleul@example.com')->firstOrFail();

        // Le parrain est figé sur le PROFIL du filleul.
        $this->assertSame($referrer->id, $filleul->profile->referred_by_id);
        $this->assertSame(ReferralSignup::STATUS_PENDING, ReferralSignup::where('filleul_user_id', $filleul->id)->value('status'));
        // Pas encore compté : l'inscription n'est pas validée.
        $this->assertSame(0, $referrer->fresh()->profile->referral_signups_count);
    }

    public function test_temp_email_domain_marks_signup_invalid(): void
    {
        $referrer = $this->createReferrer();

        ReferralBlacklist::create(['type' => 'email_domain', 'value' => 'yopmail.com']);

        $this->trackVisit($referrer);
        $this->withCredentials()->withUnencryptedCookies([
            ReferralTrackingService::COOKIE_NAME => $referrer->fresh()->profile->referral_code,
        ])->postJson('/api/auth/register', [
            'name' => 'Fraudeur',
            'email' => 'fraude@yopmail.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ])->assertCreated();

        $this->assertSame('invalid', ReferralSignup::where('invalid_reason', 'email_temporaire')->value('status'));
    }

    /*
     * ------------------------ Validation & paliers ------------------------
     */

    public function test_email_verification_grants_first_palier(): void
    {
        $referrer = $this->createReferrer();
        $reward = $this->createReward(['threshold_value' => 1, 'reward_payload' => ['days' => 7]]);

        [$filleul] = $this->registerReferredFilleul($referrer);
        $this->verifyEmail($filleul);

        // Compteur + signup valid.
        $this->assertSame(1, $referrer->fresh()->profile->referral_signups_count);
        $this->assertSame(ReferralSignup::STATUS_VALID, ReferralSignup::where('filleul_user_id', $filleul->id)->value('status'));

        // Palier 1 attribué UNE fois, livraison Pro (7 j) via payments.
        $grant = ReferralRewardGrant::where('user_id', $referrer->id)->sole();
        $this->assertSame($reward->id, $grant->reward_id);

        $payment = Payment::where('transaction_id', "referral-grant-{$grant->id}")->sole();
        $this->assertSame(0.0, (float) $payment->amount);
        $this->assertSame('referral', $payment->payment_method);
        $this->assertSame('pro', $payment->subscription_type);
        $this->assertSame(7, (int) $payment->paid_at->diffInDays($payment->expires_at));

        // Le parrain passe en Pro.
        $this->assertSame('pro', $referrer->profile->fresh()->subscription_type);

        // Notification in-app + trace Telegram admin.
        $this->assertSame(1, $referrer->notifications()->count());
    }

    public function test_email_verification_is_idempotent(): void
    {
        $referrer = $this->createReferrer();
        $this->createReward(['threshold_value' => 1]);

        [$filleul] = $this->registerReferredFilleul($referrer);
        $this->verifyEmail($filleul);
        $this->verifyEmail($filleul); // double clic / rejeu du lien

        $this->assertSame(1, $referrer->fresh()->profile->referral_signups_count);
        $this->assertSame(1, ReferralRewardGrant::count());
        $this->assertSame(1, Payment::count());
    }

    public function test_visits_condition_reward_grants_on_threshold_crossing(): void
    {
        $referrer = $this->createReferrer();
        $reward = $this->createReward([
            'condition_type' => 'visits',
            'threshold_value' => 2,
            'reward_type' => 'coupon',
            'reward_payload' => ['amount' => 25],
        ]);

        $this->trackVisit($referrer, '41.92.0.10');
        $this->assertNull(ReferralRewardGrant::first());

        $this->trackVisit($referrer, '41.92.0.11'); // 2ᵉ visite unique → seuil atteint
        $grant = ReferralRewardGrant::where('user_id', $referrer->id)->sole();

        $couponCode = $grant->delivery['code'] ?? null;
        $this->assertNotNull($couponCode);
        $coupon = DiscountCode::where('code', $couponCode)->sole();
        $this->assertSame('fixed', $coupon->type);
        $this->assertSame(25.0, (float) $coupon->value);
        $this->assertSame(1, $coupon->max_uses);
    }

    public function test_monthly_rewards_cap_blocks_extra_rewards(): void
    {
        $referrer = $this->createReferrer();
        $this->settings->set('referral_max_rewards_per_month', 1);

        $this->createReward(['name' => 'Palier A', 'threshold_value' => 2]);
        $this->createReward(['name' => 'Palier B', 'threshold_value' => 2, 'reward_payload' => ['days' => 30]]);

        [$filleul1, $filleul2] = $this->registerReferredFilleul($referrer, 2);
        $this->verifyEmail($filleul1);
        $this->verifyEmail($filleul2);

        // Cap mensuel = 1 : seul le premier palier évalué passe.
        $this->assertSame(1, ReferralRewardGrant::where('status', '!=', ReferralRewardGrant::STATUS_CANCELLED)->count());
    }

    public function test_premium_referrer_receives_coupon_instead_of_pro_days(): void
    {
        $referrer = $this->createReferrer();
        $referrer->profile->update(['subscription_type' => 'premium']);

        // Prix Pro fixé : la conversion premium → coupon en dépend.
        app(SubscriptionService::class)->setSetting('pro_price', 35);

        $this->createReward(['threshold_value' => 1, 'reward_payload' => ['days' => 7]]);

        [$filleul] = $this->registerReferredFilleul($referrer);
        $this->verifyEmail($filleul);

        // Pas de déclassement premium → Pro : coupon de valeur équivalente.
        $this->assertSame('premium', $referrer->profile->fresh()->subscription_type);
        $this->assertSame(0, Payment::count());
        $this->assertSame(1, DiscountCode::where('code', 'like', 'PARRAIN-%')->count());
    }

    /*
     * ------------------------------ Admin ------------------------------
     */

    public function test_admin_can_manage_settings_and_rewards(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);

        $this->actingAs($admin)->postJson('/api/admin/referral/settings', [
            'referral_enabled' => true,
            'referral_cookie_days' => 45,
            'referral_filleul_bonus_days' => 7,
        ])->assertOk()->assertJsonPath('settings.referral_cookie_days', 45);

        $reward = $this->actingAs($admin)->postJson('/api/admin/referral/rewards', [
            'name' => 'Nouveau palier',
            'condition_type' => 'signups',
            'reward_type' => 'pro_days',
            'reward_payload' => ['days' => 14],
            'threshold_value' => 3,
        ])->assertCreated()->assertJsonPath('reward.threshold_value', 3)->json('reward');

        // Activation/désactivation + mise à jour (POST, convention WAF).
        $this->actingAs($admin)->postJson("/api/admin/referral/rewards/{$reward['id']}/toggle")
            ->assertOk()->assertJsonPath('reward.is_active', false);

        $this->actingAs($admin)->postJson("/api/admin/referral/rewards/{$reward['id']}", [
            'name' => 'Palier modifié',
            'condition_type' => 'visits',
            'reward_type' => 'coupon',
            'reward_payload' => ['amount' => 50],
            'threshold_value' => 300,
        ])->assertOk()->assertJsonPath('reward.name', 'Palier modifié');
    }

    public function test_non_admin_cannot_access_referral_admin(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->getJson('/api/admin/referral/stats')->assertForbidden();
        $this->actingAs($user)->postJson('/api/admin/referral/rewards', [])->assertForbidden();
    }

    public function test_admin_stats_and_ranking(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $referrerA = $this->createReferrer();
        $referrerB = $this->createReferrer();

        // referrerA : 1 filleul validé. Le compteur profiles est incrémenté
        // exactement comme le fait ReferralRewardService::onSignupValidated().
        $filleul = User::factory()->create(['email_verified_at' => now()]);
        $filleul->profile()->create([
            'city_id' => City::create(['name' => 'Ville-filleul'])->id,
            'nickname' => 'filleul-'.$filleul->id,
            'referred_by_id' => $referrerA->id,
        ]);
        ReferralSignup::create([
            'referrer_user_id' => $referrerA->id,
            'filleul_user_id' => $filleul->id,
            'status' => 'valid',
            'valid_at' => now(),
        ]);
        $referrerA->profile->increment('referral_signups_count');

        ReferralVisit::create([
            'referrer_user_id' => $referrerB->id,
            'fingerprint_hash' => 'fp-1',
            'ip_hash' => 'ip-1',
            'counted' => true,
            'created_at' => now(),
        ]);
        $referrerB->profile->increment('referral_shares_count');

        $stats = $this->actingAs($admin)->getJson('/api/admin/referral/stats')
            ->assertOk()->json();

        $this->assertSame(1, $stats['parrains']);
        $this->assertSame(1, $stats['filleuls']);
        $this->assertSame(1, $stats['visits']);
        $this->assertSame(1, $stats['signups_valid']);

        // Classement par compteurs (colonnes indexées sur profiles).
        $this->actingAs($admin)->getJson('/api/admin/referral/users?sort=referral_signups_count')
            ->assertOk()
            ->assertJsonPath('users.data.0.user_id', $referrerA->id);
    }

    /*
     * ------------------------------ Helpers ------------------------------
     */

    /** Inscrit N filleuls attribués au parrain (cookie de tracking posé). */
    private function registerReferredFilleul(User $referrer, int $count = 1): array
    {
        $filleuls = [];

        for ($i = 1; $i <= $count; $i++) {
            $this->trackVisit($referrer, "41.92.1.{$i}");

            $email = "filleul{$i}-".uniqid().'@example.com';
            $this->withCredentials()->withUnencryptedCookies([
                ReferralTrackingService::COOKIE_NAME => $referrer->fresh()->profile->referral_code,
            ])->postJson('/api/auth/register', [
                'name' => "Filleul $i",
                'email' => $email,
                'password' => 'Password123!',
                'password_confirmation' => 'Password123!',
            ])->assertCreated();

            $filleuls[] = User::where('email', $email)->firstOrFail();
        }

        return $filleuls;
    }

    /** Joue le lien signé de vérification email (web route). */
    private function verifyEmail(User $user): void
    {
        $url = URL::temporarySignedRoute(
            'verification.verify',
            now()->addMinutes(10),
            ['id' => $user->id, 'hash' => sha1($user->email)]
        );

        $this->get($url)->assertRedirect();
    }
}
