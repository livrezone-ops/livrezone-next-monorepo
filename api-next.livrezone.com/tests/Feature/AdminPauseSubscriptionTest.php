<?php

namespace Tests\Feature;

use App\Models\City;
use App\Models\Payment;
use App\Models\Profile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Pause / reprise d'abonnement par l'admin.
 */
class AdminPauseSubscriptionTest extends TestCase
{
    use RefreshDatabase;

    private function makeUserWithType(string $type, bool $isAdmin = false): User
    {
        $user = User::factory()->create(['is_admin' => $isAdmin]);
        $city = City::query()->firstOrCreate(['name' => 'Ville de test']);

        Profile::withoutSyncingToSearch(fn () => Profile::create([
            'user_id' => $user->id,
            'subscription_type' => $type,
            'city_id' => $city->id,
        ]));

        return $user;
    }

    private function createPaidPayment(User $user, string $type, string $expiresAt): void
    {
        Payment::create([
            'user_id' => $user->id,
            'amount' => 30,
            'payment_method' => 'virement',
            'subscription_type' => $type,
            'period' => 'monthly',
            'status' => 'paid',
            'paid_at' => now(),
            'expires_at' => $expiresAt,
        ]);
    }

    public function test_admin_can_pause_pro_user(): void
    {
        $admin = $this->makeUserWithType('premium', isAdmin: true);
        $alice = $this->makeUserWithType('pro');
        $this->createPaidPayment($alice, 'pro', now()->addMonth());

        $this->actingAs($admin)
            ->postJson("/api/admin/users/{$alice->id}/subscription/pause")
            ->assertOk();

        $profile = $alice->profile->fresh();
        $this->assertSame('free', $profile->subscription_type);
        $this->assertSame('pro', $profile->paused_from_type);
        $this->assertNotNull($profile->paused_at);
    }

    public function test_admin_can_resume_paused_subscription(): void
    {
        $admin = $this->makeUserWithType('premium', isAdmin: true);
        $alice = $this->makeUserWithType('free');
        $this->createPaidPayment($alice, 'pro', now()->addDays(20));

        // Mise en pause manuelle (via l'API pour rester réaliste).
        $this->actingAs($admin)
            ->postJson("/api/admin/users/{$alice->id}/subscription/pause")
            ->assertOk();

        $this->actingAs($admin)
            ->postJson("/api/admin/users/{$alice->id}/subscription/resume")
            ->assertOk();

        $profile = $alice->profile->fresh();
        $this->assertSame('pro', $profile->subscription_type);
        $this->assertNull($profile->paused_from_type);
        $this->assertNull($profile->paused_at);
    }

    public function test_resume_fails_when_underlying_payment_expired(): void
    {
        $admin = $this->makeUserWithType('premium', isAdmin: true);
        $alice = $this->makeUserWithType('pro');
        $this->createPaidPayment($alice, 'pro', now()->subDays(5));

        $this->actingAs($admin)
            ->postJson("/api/admin/users/{$alice->id}/subscription/pause")
            ->assertOk();

        $this->actingAs($admin)
            ->postJson("/api/admin/users/{$alice->id}/subscription/resume")
            ->assertStatus(422);

        $this->assertSame('free', $alice->profile->fresh()->subscription_type);
    }
}
