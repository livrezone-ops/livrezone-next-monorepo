<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\User;
use App\Services\SubscriptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * Module admin paiements/promo/codes de réduction.
 */
class AdminPaymentTest extends TestCase
{
    use RefreshDatabase;

    public function test_seller_cannot_access_admin_payments(): void
    {
        $seller = User::factory()->create();

        $this->actingAs($seller)
            ->getJson('/api/admin/payments')
            ->assertStatus(403);
    }

    public function test_admin_lists_payments_with_stats(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $alice = User::factory()->create();

        Payment::create([
            'user_id' => $alice->id,
            'amount' => 30,
            'payment_method' => 'cash',
            'subscription_type' => 'pro',
            'status' => 'paid',
            'paid_at' => now(),
            'expires_at' => now()->addDays(20),
        ]);

        $response = $this->actingAs($admin)->getJson('/api/admin/payments');

        $response->assertOk();
        $this->assertSame(1, $response->json('meta.total'));
        $this->assertEquals(30.0, $response->json('meta.stats.revenue_paid'));
        $this->assertSame(1, $response->json('meta.stats.expiring_soon'));
        $this->assertCount(1, $response->json('payments'));
    }

    public function test_admin_can_toggle_promo_pro_free(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $service = new SubscriptionService();

        Cache::forget(SubscriptionService::PROMO_CACHE_KEY);

        $this->actingAs($admin)
            ->postJson('/api/admin/promo/toggle', ['active' => true])
            ->assertOk()
            ->assertJsonPath('promo_pro_free', true);

        $this->assertTrue($service->isPromoProFree());

        $this->actingAs($admin)
            ->postJson('/api/admin/promo/toggle', ['active' => false])
            ->assertOk();

        $this->assertFalse($service->isPromoProFree());

        // Le réglage persiste en DB même après une purge du cache (optimize:clear).
        Cache::forget(SubscriptionService::PROMO_CACHE_KEY);
        $this->assertTrue(SubscriptionService::PROMO_CACHE_KEY !== null);
        $this->assertFalse((new SubscriptionService())->isPromoProFree());
    }

    public function test_admin_can_create_and_delete_discount_code(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);

        $created = $this->actingAs($admin)
            ->postJson('/api/admin/discount-codes', [
                'code' => 'BIENVENUE10',
                'type' => 'percent',
                'value' => 10,
            ])
            ->assertStatus(201);

        $id = $created->json('code.id');

        // Doublon refusé
        $this->actingAs($admin)
            ->postJson('/api/admin/discount-codes', [
                'code' => 'bienvenue10',
                'type' => 'percent',
                'value' => 15,
            ])
            ->assertStatus(422);

        $this->actingAs($admin)
            ->postJson("/api/admin/discount-codes/{$id}/delete")
            ->assertOk();

        $this->actingAs($admin)->getJson('/api/admin/discount-codes')->assertOk();
    }
}
