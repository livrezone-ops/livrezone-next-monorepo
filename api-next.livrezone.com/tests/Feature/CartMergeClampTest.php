<?php

namespace Tests\Feature;

use App\Models\CartItem;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CartMergeClampTest extends TestCase
{
    use RefreshDatabase;

    /**
     * POST /api/cart/merge : la quantité cumulée (local + serveur) est bornée
     * par le stock disponible du listing (quantity), plafonné à 99.
     */
    public function test_merge_clamps_quantity_to_listing_stock(): void
    {
        $user = User::factory()->create();

        $listing = Listing::create([
            'user_id' => $user->id,
            'listing_type' => 'single',
            'title' => 'Livre de test',
            'book_condition' => 'neuf',
            'price' => 50.00,
            'quantity' => 5, // stock disponible
            'status' => 'published',
        ]);

        // Le compte a déjà 3 exemplaires au panier.
        CartItem::create([
            'user_id' => $user->id,
            'listing_id' => $listing->id,
            'quantity' => 3,
        ]);

        Sanctum::actingAs($user);

        // Fusion guest : 4 exemplaires supplémentaires -> 3 + 4 = 7 > 5 (stock)
        $response = $this->postJson('/api/cart/merge', [
            'items' => [
                ['listing_id' => $listing->id, 'quantity' => 4],
            ],
        ]);

        $response->assertOk()
            ->assertJson([
                'merged' => 1,
                'clamped' => 1,
                'count' => 5, // borné au stock
            ]);

        $this->assertDatabaseHas('cart_items', [
            'user_id' => $user->id,
            'listing_id' => $listing->id,
            'quantity' => 5,
        ]);
    }

    /**
     * La fusion sans dépassement conserve la quantité cumulée.
     */
    public function test_merge_keeps_quantity_within_stock(): void
    {
        $user = User::factory()->create();

        $listing = Listing::create([
            'user_id' => $user->id,
            'listing_type' => 'single',
            'title' => 'Livre de test 2',
            'book_condition' => 'occas',
            'price' => 30.00,
            'quantity' => 10,
            'status' => 'published',
        ]);

        CartItem::create([
            'user_id' => $user->id,
            'listing_id' => $listing->id,
            'quantity' => 2,
        ]);

        Sanctum::actingAs($user);

        $response = $this->postJson('/api/cart/merge', [
            'items' => [
                ['listing_id' => $listing->id, 'quantity' => 3],
            ],
        ]);

        $response->assertOk()
            ->assertJson([
                'merged' => 1,
                'clamped' => 0,
                'count' => 5, // 2 + 3 = 5, pas de clamp
            ]);
    }
}
