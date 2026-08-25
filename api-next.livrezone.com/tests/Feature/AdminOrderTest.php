<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Régressions sécurité du module admin "demandes" :
 * seul l'admin liste et modère les demandes globalement.
 */
class AdminOrderTest extends TestCase
{
    use RefreshDatabase;

    private function createOrder(User $user, string $status = 'pending_admin'): Order
    {
        return Order::withoutSyncingToSearch(fn () => Order::create([
            'user_id' => $user->id,
            'title' => 'Recherche : Les Misérables',
            'status' => $status,
        ]));
    }

    public function test_seller_cannot_access_admin_orders(): void
    {
        $seller = User::factory()->create();

        $this->actingAs($seller)
            ->getJson('/api/admin/orders')
            ->assertStatus(403);
    }

    public function test_admin_lists_all_orders_with_counts(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $alice = User::factory()->create();
        $bob = User::factory()->create();

        $this->createOrder($alice, 'pending_admin');
        $this->createOrder($bob, 'published');

        $response = $this->actingAs($admin)->getJson('/api/admin/orders');

        $response->assertOk();
        $this->assertSame(2, $response->json('meta.total'));
        $this->assertSame(1, $response->json('meta.status_counts.pending'));
        $this->assertCount(2, $response->json('orders'));
    }

    public function test_admin_can_publish_pending_order(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $alice = User::factory()->create();
        $order = $this->createOrder($alice, 'pending_admin');

        $this->actingAs($admin)
            ->postJson("/api/admin/orders/{$order->id}/status", ['action' => 'publish'])
            ->assertOk();

        $fresh = $order->fresh();
        $this->assertSame('published', $fresh->status);
        $this->assertNotNull($fresh->published_at);
    }

    public function test_admin_can_reject_and_fulfill(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $alice = User::factory()->create();
        $order = $this->createOrder($alice, 'published');

        $this->actingAs($admin)
            ->postJson("/api/admin/orders/{$order->id}/status", ['action' => 'fulfill'])
            ->assertOk();
        $this->assertSame('fulfilled', $order->fresh()->status);

        $this->actingAs($admin)
            ->postJson("/api/admin/orders/{$order->id}/status", ['action' => 'reject'])
            ->assertOk();
        $this->assertSame('rejected', $order->fresh()->status);
    }
}
