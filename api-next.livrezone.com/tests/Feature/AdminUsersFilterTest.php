<?php

namespace Tests\Feature;

use App\Models\City;
use App\Models\Profile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Filtres de la liste utilisateurs (admin) : type de compte, connexion.
 */
class AdminUsersFilterTest extends TestCase
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

    public function test_admin_can_filter_users_by_subscription_type(): void
    {
        $admin = $this->makeUserWithType('premium', isAdmin: true);
        $this->makeUserWithType('free');
        $this->makeUserWithType('pro');
        $this->makeUserWithType('pro');

        // L'admin lui-même (premium) est exclu du filtre pro.
        $response = $this->actingAs($admin)
            ->getJson('/api/admin/users?type=pro')
            ->assertOk();

        $this->assertSame(2, $response->json('meta.total'));
    }

    public function test_admin_users_filter_free_excludes_paid(): void
    {
        $admin = $this->makeUserWithType('premium', isAdmin: true);
        $this->makeUserWithType('free');

        $response = $this->actingAs($admin)
            ->getJson('/api/admin/users?type=free')
            ->assertOk();

        $this->assertSame(1, $response->json('meta.total'));
    }

    public function test_admin_can_sort_users_by_last_activity(): void
    {
        // Régression : 'last_activity' n'est pas une colonne réelle,
        // le tri doit passer par COALESCE(last_activity_at, last_login_at).
        $admin = $this->makeUserWithType('premium', isAdmin: true);
        $this->makeUserWithType('free');

        $this->actingAs($admin)
            ->getJson('/api/admin/users?sort_by=last_activity&sort_dir=desc')
            ->assertOk();

        $this->actingAs($admin)
            ->getJson('/api/admin/users?sort_by=name&sort_dir=asc')
            ->assertOk();
    }
}
