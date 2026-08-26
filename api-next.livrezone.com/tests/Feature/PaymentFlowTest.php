<?php

namespace Tests\Feature;

use App\Mail\PaymentConfirmedMail;
use App\Models\City;
use App\Models\Payment;
use App\Models\Profile;
use App\Models\User;
use App\Services\SubscriptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Parcours d'abonnement : demande utilisateur → validation admin → activation.
 */
class PaymentFlowTest extends TestCase
{
    use RefreshDatabase;

    private function makeProfile(User $user, string $type = 'free'): void
    {
        $city = City::query()->firstOrCreate(['name' => 'Ville de test']);

        Profile::withoutSyncingToSearch(fn () => Profile::create([
            'user_id' => $user->id,
            'subscription_type' => $type,
            'city_id' => $city->id,
        ]));
    }

    public function test_user_can_create_payment_request_with_yearly_pricing(): void
    {
        Cache::flush();
        $user = User::factory()->create();
        $this->makeProfile($user);

        $response = $this->actingAs($user)->postJson('/api/payments', [
            'subscription_type' => 'pro',
            'period' => 'yearly',
            'payment_method' => 'virement',
        ]);

        $response->assertStatus(201);
        // Annuel par défaut = 10x le mensuel (30 x 10 = 300).
        $this->assertEquals(300.0, $response->json('payment.amount'));
        $this->assertSame('pending', $response->json('payment.status'));
    }

    public function test_new_request_replaces_abandoned_pending_one(): void
    {
        Cache::flush();
        $user = User::factory()->create();
        $this->makeProfile($user);

        $this->actingAs($user)->postJson('/api/payments', [
            'subscription_type' => 'pro',
            'period' => 'monthly',
            'payment_method' => 'especes',
        ])->assertStatus(201);

        // La nouvelle demande remplace l'ancienne au lieu d'être refusée.
        $this->actingAs($user)->postJson('/api/payments', [
            'subscription_type' => 'premium',
            'period' => 'yearly',
            'payment_method' => 'virement',
        ])->assertStatus(201);

        $this->assertSame(1, Payment::where('user_id', $user->id)->where('status', 'pending')->count());
        $this->assertSame('premium', Payment::latest('id')->first()->subscription_type);
    }

    public function test_admin_mark_paid_activates_subscription_for_full_year(): void
    {
        Cache::flush();
        Mail::fake();
        $admin = User::factory()->create(['is_admin' => true]);
        $user = User::factory()->create();
        $this->makeProfile($user);

        $this->actingAs($user)->postJson('/api/payments', [
            'subscription_type' => 'premium',
            'period' => 'yearly',
            'payment_method' => 'cheque',
        ]);

        $payment = Payment::where('user_id', $user->id)->firstOrFail();

        $this->actingAs($admin)
            ->postJson("/api/admin/payments/{$payment->id}/mark-paid")
            ->assertOk();

        $payment->refresh();
        $this->assertSame('paid', $payment->status);
        $this->assertNotNull($payment->expires_at);
        // Abonnement activé pour 12 mois (±2 jours de tolérance horaire).
        $this->assertEqualsWithDelta(
            now()->addMonths(12)->timestamp,
            $payment->expires_at->timestamp,
            120
        );

        $this->assertSame('premium', $user->profile->fresh()->subscription_type);

        // L'email de confirmation part après l'activation effective.
        Mail::assertSent(PaymentConfirmedMail::class);
    }

    public function test_seller_cannot_mark_payments_paid(): void
    {
        $seller = User::factory()->create();
        $this->makeProfile($seller);
        $payment = Payment::create([
            'user_id' => $seller->id,
            'amount' => 30,
            'payment_method' => 'virement',
            'subscription_type' => 'pro',
            'period' => 'monthly',
            'status' => 'pending',
        ]);

        $this->actingAs($seller)
            ->postJson("/api/admin/payments/{$payment->id}/mark-paid")
            ->assertStatus(403);
    }
}
