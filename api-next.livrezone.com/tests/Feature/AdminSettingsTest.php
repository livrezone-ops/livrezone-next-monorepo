<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\User;
use App\Services\SubscriptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
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
        $this->service = new SubscriptionService();
        Cache::flush();
    }

    public function test_admin_can_update_tarification_settings(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);

        $response = $this->actingAs($admin)->putJson('/api/admin/settings', [
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

        $this->actingAs($admin)->putJson('/api/admin/settings', ['max_free_listings' => 5]);

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
            ->putJson('/api/admin/settings', ['max_free_listings' => 1])
            ->assertStatus(403);
    }
}
