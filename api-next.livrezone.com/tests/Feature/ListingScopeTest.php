<?php

namespace Tests\Feature;

use App\Models\Listing;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Régressions sécurité du dashboard :
 * - un vendeur ne voit JAMAIS les annonces des autres ;
 * - un vendeur ne peut JAMAIS valider/publier une annonce (lui-même ou autrui) ;
 * - les actions en masse n'affectent que SES annonces.
 */
class ListingScopeTest extends TestCase
{
    use RefreshDatabase;

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

    public function test_seller_only_sees_his_own_listings(): void
    {
        $alice = User::factory()->create();
        $bob = User::factory()->create();

        $aliceListing = $this->createListing($alice, title: 'Annonce Alice');
        $this->createListing($bob, title: 'Annonce Bob');

        $response = $this->actingAs($alice)->getJson('/api/dashboard/listings?filter=all');

        $response->assertOk();
        $ids = collect($response->json('listings'))->pluck('id');
        $this->assertSame([$aliceListing->id], $ids->all());
        $this->assertSame(1, $response->json('meta.total'));
    }

    public function test_seller_cannot_set_published_status_on_own_listing(): void
    {
        $alice = User::factory()->create();
        $listing = $this->createListing($alice, status: 'archived');

        // Tentative d'auto-validation : refusée par la validation (statut hors whitelist).
        $this->actingAs($alice)
            ->postJson("/api/dashboard/listings/{$listing->id}/status", ['status' => 'published'])
            ->assertStatus(422);

        $this->assertSame('archived', $listing->fresh()->status);
    }

    public function test_seller_cannot_modify_status_of_foreign_listing(): void
    {
        $alice = User::factory()->create();
        $bob = User::factory()->create();
        $bobListing = $this->createListing($bob, status: 'published');

        $this->actingAs($alice)
            ->postJson("/api/dashboard/listings/{$bobListing->id}/status", ['status' => 'sold'])
            ->assertStatus(403);

        $this->assertSame('published', $bobListing->fresh()->status);
    }

    public function test_bulk_status_only_affects_own_listings(): void
    {
        $alice = User::factory()->create();
        $bob = User::factory()->create();

        $aliceListing = $this->createListing($alice, status: 'published');
        $bobListing = $this->createListing($bob, status: 'published');

        $this->actingAs($alice)
            ->postJson('/api/dashboard/listings/bulk-status', [
                'ids' => [$aliceListing->id, $bobListing->id],
                'status' => 'sold',
            ])
            ->assertOk()
            ->assertJsonPath('updated', 1);

        $this->assertSame('sold', $aliceListing->fresh()->status);
        $this->assertSame('published', $bobListing->fresh()->status);
    }

    public function test_bulk_discount_only_affects_own_listings(): void
    {
        $alice = User::factory()->create();
        $bob = User::factory()->create();

        $aliceListing = $this->createListing($alice); // prix 10
        $bobListing = $this->createListing($bob);

        $this->actingAs($alice)
            ->postJson('/api/dashboard/listings/bulk-discount', [
                'ids' => [$aliceListing->id, $bobListing->id],
                'discount_percentage' => 50,
            ])
            ->assertOk()
            ->assertJsonPath('updated', 1);

        $this->assertEquals(5.0, (float) $aliceListing->fresh()->discount_price);
        $this->assertNull($bobListing->fresh()->discount_price);
    }

    public function test_admin_can_activate_listing_but_seller_cannot(): void
    {
        $seller = User::factory()->create();
        $admin = User::factory()->create(['is_admin' => true]);
        $listing = $this->createListing($seller, status: 'pending_admin');

        // Le vendeur ne passe pas le middleware admin.
        $this->actingAs($seller)
            ->postJson("/api/admin/listings/{$listing->id}/status", ['action' => 'activate'])
            ->assertStatus(403);
        $this->assertSame('pending_admin', $listing->fresh()->status);

        // L'admin valide l'annonce.
        $this->actingAs($admin)
            ->postJson("/api/admin/listings/{$listing->id}/status", ['action' => 'activate'])
            ->assertOk();

        $this->assertSame('published', $listing->fresh()->status);
    }
}
