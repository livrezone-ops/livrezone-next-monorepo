<?php

namespace Tests\Feature;

use App\Models\City;
use App\Models\Listing;
use App\Models\Payment;
use App\Models\Profile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Fiche utilisateur admin (GET /api/admin/users/{user}) et cohérence
 * annonces <-> statut du compte : désactiver un utilisateur masque toutes
 * ses annonces visibles, le réactiver remet ses annonces masquées en ligne.
 */
class AdminUserDetailTest extends TestCase
{
    use RefreshDatabase;

    private function testCityId(): int
    {
        return City::query()->firstOrCreate(['name' => 'Ville de test'])->id;
    }

    private function createListing(User $user, string $status = 'published', string $title = 'Livre test'): Listing
    {
        return Listing::withoutSyncingToSearch(fn () => Listing::create([
            'user_id' => $user->id,
            'title' => $title,
            'book_condition' => 'occas',
            'price' => 10,
            'status' => $status,
        ]));
    }

    private function admin(): User
    {
        $admin = User::factory()->create(['is_admin' => true]);
        Profile::withoutSyncingToSearch(fn () => Profile::create([
            'user_id' => $admin->id,
            'subscription_type' => 'premium',
            'city_id' => $this->testCityId(),
        ]));

        return $admin;
    }

    public function test_admin_can_fetch_user_detail_with_payments(): void
    {
        $admin = $this->admin();
        $user = User::factory()->create([
            'last_login_at' => now()->subMinutes(30),
        ]);
        Profile::withoutSyncingToSearch(fn () => Profile::create([
            'user_id' => $user->id,
            'subscription_type' => 'pro',
            'phone' => '0612345678',
            'has_whatsapp' => true,
            'city_id' => $this->testCityId(),
        ]));
        $this->createListing($user);
        Payment::create([
            'user_id' => $user->id,
            'amount' => 30,
            'payment_method' => 'cash',
            'subscription_type' => 'pro',
            'status' => 'paid',
            'paid_at' => now(),
        ]);

        $response = $this->actingAs($admin)
            ->getJson("/api/admin/users/{$user->id}")
            ->assertOk();

        $this->assertSame($user->id, $response->json('id'));
        $this->assertSame($user->email, $response->json('email'));
        $this->assertSame('0612345678', $response->json('profile.phone'));
        $this->assertSame('pro', $response->json('profile.subscription_type'));
        $this->assertSame(1, $response->json('listings_count'));
        $this->assertFalse($response->json('connection.online'));
        $this->assertCount(1, $response->json('payments'));
        $this->assertSame('paid', $response->json('payments.0.status'));
        $this->assertSame('30.00', (string) $response->json('payments.0.amount'));
    }

    public function test_non_admin_cannot_fetch_user_detail(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();

        $this->actingAs($other)
            ->getJson("/api/admin/users/{$user->id}")
            ->assertForbidden();
    }

    public function test_deactivating_user_hides_all_visible_listings(): void
    {
        $admin = $this->admin();
        $user = User::factory()->create();

        $published = $this->createListing($user, 'published', 'Annonce publiée');
        $pending = $this->createListing($user, 'pending_admin', 'Annonce en attente');
        $sold = $this->createListing($user, 'sold', 'Annonce vendue');
        $otherListing = $this->createListing($admin, 'published', 'Annonce admin');

        $response = $this->actingAs($admin)
            ->postJson("/api/admin/users/{$user->id}/status", ['is_active' => false])
            ->assertOk();

        $this->assertSame('hidden', $published->fresh()->status);
        $this->assertSame('hidden', $pending->fresh()->status);
        // Une annonce vendue n'est pas une annonce « visible » : inchangée.
        $this->assertSame('sold', $sold->fresh()->status);
        $this->assertSame('published', $otherListing->fresh()->status);
        $this->assertFalse((bool) $response->json('user.is_active'));
    }

    public function test_activating_user_republishes_hidden_listings(): void
    {
        $admin = $this->admin();
        $user = User::factory()->create();

        $hidden1 = $this->createListing($user, 'hidden', 'Annonce masquée 1');
        $hidden2 = $this->createListing($user, 'hidden', 'Annonce masquée 2');
        $sold = $this->createListing($user, 'sold', 'Annonce vendue');

        $this->actingAs($admin)
            ->postJson("/api/admin/users/{$user->id}/status", ['is_active' => true])
            ->assertOk();

        $this->assertSame('published', $hidden1->fresh()->status);
        $this->assertSame('published', $hidden2->fresh()->status);
        $this->assertSame('sold', $sold->fresh()->status);
    }
}
