<?php

namespace Tests\Feature;

use App\Mail\PaymentConfirmedMail;
use App\Models\City;
use App\Models\DiscountCode;
use App\Models\Payment;
use App\Models\Profile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Simulateur de paiement (PAYMENT_SIMULATOR) + application des coupons.
 */
class PaymentSimulatorTest extends TestCase
{
    use RefreshDatabase;

    private function makeFreeProfile(User $user): void
    {
        $city = City::query()->firstOrCreate(['name' => 'Ville de test']);

        Profile::withoutSyncingToSearch(fn () => Profile::create([
            'user_id' => $user->id,
            'subscription_type' => 'free',
            'city_id' => $city->id,
        ]));
    }

    private function createPendingPayment(User $user, string $code = null): Payment
    {
        return Payment::create([
            'user_id' => $user->id,
            'amount' => 30,
            'payment_method' => 'virement',
            'subscription_type' => 'pro',
            'period' => 'monthly',
            'discount_code' => $code,
            'status' => 'pending',
        ]);
    }

    public function test_simulator_is_blocked_when_disabled(): void
    {
        Config::set('livrezone.payment_simulator', false);
        $user = User::factory()->create();
        $this->makeFreeProfile($user);
        $payment = $this->createPendingPayment($user);

        $this->actingAs($user)
            ->postJson("/api/payments/{$payment->id}/simulate-confirm")
            ->assertStatus(403);

        $this->assertSame('pending', $payment->fresh()->status);
    }

    public function test_user_cannot_confirm_foreign_payment(): void
    {
        Config::set('livrezone.payment_simulator', true);
        $alice = User::factory()->create();
        $bob = User::factory()->create();
        $payment = $this->createPendingPayment($bob);

        $this->actingAs($alice)
            ->postJson("/api/payments/{$payment->id}/simulate-confirm")
            ->assertStatus(403);
    }

    public function test_simulator_confirms_payment_and_upgrades_profile(): void
    {
        Cache::flush();
        Config::set('livrezone.payment_simulator', true);
        Mail::fake();
        $user = User::factory()->create();
        $this->makeFreeProfile($user);
        $payment = $this->createPendingPayment($user);

        $this->actingAs($user)
            ->postJson("/api/payments/{$payment->id}/simulate-confirm")
            ->assertOk();

        $payment->refresh();
        $this->assertSame('paid', $payment->status);
        $this->assertNotNull($payment->expires_at);
        $this->assertSame('pro', $user->profile->fresh()->subscription_type);
        Mail::assertSent(PaymentConfirmedMail::class);
    }

    public function test_coupon_discount_applied_and_consumed_on_confirmation(): void
    {
        Cache::flush();
        Config::set('livrezone.payment_simulator', true);
        DiscountCode::create([
            'code' => 'BIENVENUE10',
            'type' => 'percent',
            'value' => 10,
            'is_active' => true,
            'max_uses' => 5,
        ]);

        $user = User::factory()->create();
        $this->makeFreeProfile($user);

        // 30 DH - 10% = 27 DH
        $created = $this->actingAs($user)->postJson('/api/payments', [
            'subscription_type' => 'pro',
            'period' => 'monthly',
            'payment_method' => 'virement',
            'discount_code' => 'bienvenue10', // insensible à la casse
        ])->assertStatus(201);

        $this->assertEquals(27.0, $created->json('payment.amount'));

        $paymentId = $created->json('payment.id');
        $this->actingAs($user)
            ->postJson("/api/payments/{$paymentId}/simulate-confirm")
            ->assertOk();

        $coupon = DiscountCode::where('code', 'BIENVENUE10')->first();
        $this->assertSame(1, $coupon->times_used);
    }

    public function test_expired_coupon_is_rejected(): void
    {
        DiscountCode::create([
            'code' => 'EXPIRE',
            'type' => 'fixed',
            'value' => 5,
            'is_active' => true,
            'expires_at' => now()->subDay(),
        ]);

        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/payments', [
            'subscription_type' => 'pro',
            'period' => 'monthly',
            'payment_method' => 'virement',
            'discount_code' => 'EXPIRE',
        ])->assertStatus(422);
    }

    public function test_preview_shows_discounted_amount_without_creating_payment(): void
    {
        DiscountCode::create([
            'code' => 'PROMO20',
            'type' => 'percent',
            'value' => 20,
            'is_active' => true,
        ]);

        $user = User::factory()->create();

        // Coupon valide : aperçu réduit, aucun paiement créé.
        $response = $this->actingAs($user)->postJson('/api/payments/preview', [
            'subscription_type' => 'pro',
            'period' => 'monthly',
            'discount_code' => 'PROMO20',
        ])->assertOk();

        $response->assertJson([
            'base_amount' => 30.0,
            'amount' => 24.0,
            'coupon_valid' => true,
            'discount' => 6.0,
        ]);

        $this->assertSame(0, Payment::count());
    }
}
