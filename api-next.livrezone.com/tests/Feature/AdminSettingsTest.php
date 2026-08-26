<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\User;
use App\Services\PaymentGatewayService;
use App\Services\SubscriptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

/**
 * Réglages tarification pilotés depuis l'admin (table settings + cache).
 */
class AdminSettingsTest extends TestCase
{
    use RefreshDatabase;

    private SubscriptionService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new SubscriptionService;
        Cache::flush();
    }

    public function test_admin_can_update_tarification_settings(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);

        $response = $this->actingAs($admin)->postJson('/api/admin/settings', [
            'max_free_listings' => 10,
            'pro_price' => 35.5,
            'subscription_grace_period_days' => 7,
        ]);

        $response->assertOk()
            ->assertJsonPath('settings.max_free_listings', 10)
            ->assertJsonPath('settings.pro_price', 35.5)
            ->assertJsonPath('settings.subscription_grace_period_days', 7);

        // Les getters du service reflètent immédiatement les nouveaux réglages.
        $this->assertSame(10, $this->service->getMaxFreeListings());
        $this->assertEquals(35.5, $this->service->getProPrice());
        $this->assertSame(7, $this->service->getGracePeriodDays());
    }

    public function test_settings_survive_cache_flush(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);

        $this->actingAs($admin)->postJson('/api/admin/settings', ['max_free_listings' => 5]);

        Cache::flush(); // simule optimize:clear lors d'un déploiement

        $this->assertSame(5, $this->service->getMaxFreeListings());
    }

    public function test_env_fallback_applies_when_no_setting_saved(): void
    {
        // Aucun réglage en DB : repli sur les variables d'environnement de phpunit.xml.
        $this->assertSame(25, $this->service->getMaxFreeListings());
        $this->assertSame(3, $this->service->getNotificationDelayHours());

        Setting::create(['key' => 'max_free_listings', 'value' => '40']);
        Cache::flush();

        $this->assertSame(40, $this->service->getMaxFreeListings());
    }

    public function test_seller_cannot_update_settings(): void
    {
        $seller = User::factory()->create();

        $this->actingAs($seller)
            ->postJson('/api/admin/settings', ['max_free_listings' => 1])
            ->assertStatus(403);
    }

    public function test_disabling_payment_method_persists_and_can_be_reenabled(): void
    {
        // Régression : désactiver un moyen stockait '' (chaîne vide), relu
        // comme absent -> retombait sur la valeur par défaut (activé).
        $admin = User::factory()->create(['is_admin' => true]);

        $this->actingAs($admin)->postJson('/api/admin/settings', [
            'method_cheque' => false,
            'method_autre' => false,
        ])->assertOk()
            ->assertJsonPath('settings.method_cheque', 0)
            ->assertJsonPath('settings.method_autre', 0);

        Cache::flush(); // même après purge du cache

        $service = new SubscriptionService;
        $methods = $service->enabledPaymentMethods();
        $this->assertNotContains('cheque', $methods);
        $this->assertNotContains('autre', $methods);
        $this->assertContains('virement', $methods);

        // Réactivation
        $this->actingAs($admin)->postJson('/api/admin/settings', ['method_cheque' => true])->assertOk();
        $this->assertContains('cheque', (new SubscriptionService)->enabledPaymentMethods());
    }

    public function test_admin_can_toggle_payment_gateways(): void
    {
        Config::set('livrezone.payment_simulator', false);
        $admin = User::factory()->create(['is_admin' => true]);
        $service = app(PaymentGatewayService::class);

        // Réglages absents -> repli .env (false dans les tests).
        $this->assertNotContains('cmi', $service->enabled());

        $this->actingAs($admin)->postJson('/api/admin/settings', ['gateway_cmi' => true])->assertOk();

        $settings = json_decode(
            $this->actingAs($admin)->getJson('/api/admin/settings')->getContent(),
            true
        )['settings'];
        $this->assertSame(1, $settings['gateway_cmi']);
        $this->assertSame(0, $settings['gateway_fatourati']);

        $gateways = app(PaymentGatewayService::class);
        $this->assertContains('cmi', $gateways->enabled());
        $this->assertNotContains('fatourati', $gateways->enabled());

        // /reference-data expose la passerelle au frontend
        $ref = $this->actingAs($admin)->getJson('/api/reference-data');
        $ref->assertOk();
    }
}
