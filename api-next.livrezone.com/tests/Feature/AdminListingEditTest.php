<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Édition admin d'une annonce (modération) : GET + POST /admin/listings/{listing}.
 * Conformément à la sémantique verrouillée (AuthorizationPolicyTest), l'admin
 * n'utilise PAS ListingPolicy@update (réservée au propriétaire) : l'autorisation
 * passe par le middleware 'admin' des routes dédiées, et la mise à jour réutilise
 * le pipeline vendeur (ListingManagerController::performUpdate).
 */
class AdminListingEditTest extends TestCase
{
    use RefreshDatabase;

    private function createListing(User $user, string $status = 'published'): Listing
    {
        return Listing::withoutSyncingToSearch(fn () => Listing::create([
            'user_id' => $user->id,
            'title' => 'Livre test',
            'book_condition' => 'occas',
            'price' => 10,
            'status' => $status,
        ]));
    }

    private function createCategory(): Category
    {
        return Category::create([
            'code' => 'test-cat',
            'name_fr' => 'Catégorie test',
            'slug' => 'categorie-test',
            'is_active' => true,
        ]);
    }

    public function test_seller_cannot_use_admin_listing_edit_endpoints(): void
    {
        $owner = User::factory()->create();
        $listing = $this->createListing($owner);
        $category = $this->createCategory();

        // Un simple vendeur (même le propriétaire) ne passe pas le middleware 'admin'.
        $this->actingAs($owner)
            ->getJson("/api/admin/listings/{$listing->id}")
            ->assertStatus(403);

        $this->actingAs($owner)
            ->postJson("/api/admin/listings/{$listing->id}", [
                'title' => 'Hack',
                'book_condition' => 'occas',
                'price' => 1,
                'category_id' => $category->id,
            ])
            ->assertStatus(403);

        // Rien n'a été modifié.
        $this->assertSame('Livre test', $listing->fresh()->title);
        $this->assertSame(10.0, (float) $listing->fresh()->price);
    }

    public function test_admin_can_show_foreign_listing_for_edit(): void
    {
        $owner = User::factory()->create();
        $admin = User::factory()->create(['is_admin' => true]);
        $this->createCategory();
        $listing = $this->createListing($owner, status: 'pending_admin');

        $response = $this->actingAs($admin)
            ->getJson("/api/admin/listings/{$listing->id}")
            ->assertOk();

        $this->assertSame('Livre test', $response->json('listing.title'));
        $this->assertSame($owner->id, $response->json('listing.user_id'));
    }

    public function test_admin_can_update_foreign_listing(): void
    {
        $owner = User::factory()->create();
        $admin = User::factory()->create(['is_admin' => true]);
        $category = $this->createCategory();
        $listing = $this->createListing($owner, status: 'published');

        // Prix et quantité uniquement : les données principales (titre,
        // description, ISBN, couverture) restent inchangées, le statut est
        // donc conservé — même règle de re-validation que la mise à jour vendeur.
        $this->actingAs($admin)
            ->postJson("/api/admin/listings/{$listing->id}", [
                'title' => 'Livre test',
                'book_condition' => 'occas',
                'price' => 15.5,
                'quantity' => 2,
                'category_id' => $category->id,
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Annonce mise à jour avec succès');

        $fresh = $listing->fresh();
        $this->assertSame(15.5, (float) $fresh->price);
        $this->assertSame(2, (int) $fresh->quantity);
        $this->assertSame($category->id, (int) $fresh->category_id);
        $this->assertSame('published', $fresh->status);
        // L'admin ne peut pas détourner la propriété de l'annonce.
        $this->assertSame($owner->id, $fresh->user_id);
    }

    public function test_admin_update_of_main_data_revalidates_status(): void
    {
        $owner = User::factory()->create();
        $admin = User::factory()->create(['is_admin' => true]);
        $category = $this->createCategory();
        $listing = $this->createListing($owner, status: 'published');

        // Changement du titre = donnée principale altérée → retour en
        // pending_admin (règle de re-validation commune au vendeur et à l'admin),
        // comme un vendeur qui modifierait son annonce publiée.
        $this->actingAs($admin)
            ->postJson("/api/admin/listings/{$listing->id}", [
                'title' => 'Titre corrigé par l\'admin',
                'book_condition' => 'occas',
                'price' => 10,
                'category_id' => $category->id,
            ])
            ->assertOk();

        $fresh = $listing->fresh();
        $this->assertSame('Titre corrigé par l\'admin', $fresh->title);
        $this->assertSame('pending_admin', $fresh->status);
    }
}
