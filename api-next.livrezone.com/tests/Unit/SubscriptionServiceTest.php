<?php

namespace Tests\Unit;

use App\Models\Listing;
use App\Models\Profile;
use App\Models\User;
use App\Services\SubscriptionService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SubscriptionServiceTest extends TestCase
{
    use RefreshDatabase;

    private function makeProfile(User $user, string $type): Profile
    {
        return Profile::withoutSyncingToSearch(function () use ($user, $type) {
            return Profile::create([
                'user_id' => $user->id,
                'subscription_type' => $type,
            ]);
        });
    }

    public function test_default_configuration_values(): void
    {
        $service = new SubscriptionService();

        $this->assertSame(25, $service->getMaxFreeListings());
        $this->assertSame(30.0, $service->getProPrice());
        $this->assertSame(50.0, $service->getPremiumPrice());
        $this->assertSame(3, $service->getNotificationDelayHours());
        $this->assertFalse($service->isPromoProFree());
    }

    public function test_promo_pro_free_makes_free_behave_as_pro(): void
    {
        $originalServer = $_SERVER['PROMO_PRO_FREE'] ?? null;
        $originalEnv = $_ENV['PROMO_PRO_FREE'] ?? null;
        putenv('PROMO_PRO_FREE=true');
        $_SERVER['PROMO_PRO_FREE'] = 'true';
        $_ENV['PROMO_PRO_FREE'] = 'true';

        try {
            $service = new SubscriptionService();
            $freeProfile = $this->makeProfile(User::factory()->create(), 'free');

            $this->assertTrue($service->isPromoProFree());
            $this->assertSame('pro', $service->getEffectiveSubscription($freeProfile));
            $this->assertTrue($service->canViewDemandes($freeProfile));
            $this->assertTrue($service->canReceiveNotifications($freeProfile));
        } finally {
            putenv('PROMO_PRO_FREE=false');
            if ($originalServer === null) {
                unset($_SERVER['PROMO_PRO_FREE']);
            } else {
                $_SERVER['PROMO_PRO_FREE'] = $originalServer;
            }
            if ($originalEnv === null) {
                unset($_ENV['PROMO_PRO_FREE']);
            } else {
                $_ENV['PROMO_PRO_FREE'] = $originalEnv;
            }
        }
    }

    public function test_can_view_demandes_per_subscription(): void
    {
        $service = new SubscriptionService();

        $free = $this->makeProfile(User::factory()->create(), 'free');
        $pro = $this->makeProfile(User::factory()->create(), 'pro');
        $premium = $this->makeProfile(User::factory()->create(), 'premium');

        $this->assertFalse($service->canViewDemandes($free));
        $this->assertTrue($service->canViewDemandes($pro));
        $this->assertTrue($service->canViewDemandes($premium));
    }

    public function test_can_receive_notifications_per_subscription(): void
    {
        $service = new SubscriptionService();

        $free = $this->makeProfile(User::factory()->create(), 'free');
        $pro = $this->makeProfile(User::factory()->create(), 'pro');
        $premium = $this->makeProfile(User::factory()->create(), 'premium');

        $this->assertFalse($service->canReceiveNotifications($free));
        $this->assertTrue($service->canReceiveNotifications($pro));
        $this->assertTrue($service->canReceiveNotifications($premium));
    }

    public function test_allowed_notification_channels_per_subscription(): void
    {
        $service = new SubscriptionService();

        $pro = $this->makeProfile(User::factory()->create(), 'pro');
        $premium = $this->makeProfile(User::factory()->create(), 'premium');

        $this->assertSame(['database'], $service->allowedNotificationChannels($pro));
        $this->assertSame(
            ['mail', 'database', 'telegram'],
            $service->allowedNotificationChannels($premium)
        );
    }

    public function test_demandes_visibility_threshold(): void
    {
        $service = new SubscriptionService();

        $pro = $this->makeProfile(User::factory()->create(), 'pro');
        $premium = $this->makeProfile(User::factory()->create(), 'premium');

        $threshold = $service->getDemandesVisibilityThreshold($pro);
        $this->assertInstanceOf(Carbon::class, $threshold);
        $this->assertTrue($threshold->equalTo(now()->subHours(3)));

        $this->assertNull($service->getDemandesVisibilityThreshold($premium));
    }

    public function test_get_effective_subscription_without_promo(): void
    {
        $service = new SubscriptionService();

        $free = $this->makeProfile(User::factory()->create(), 'free');
        $pro = $this->makeProfile(User::factory()->create(), 'pro');
        $premium = $this->makeProfile(User::factory()->create(), 'premium');

        $this->assertSame('free', $service->getEffectiveSubscription($free));
        $this->assertSame('pro', $service->getEffectiveSubscription($pro));
        $this->assertSame('premium', $service->getEffectiveSubscription($premium));
    }

    public function test_change_subscription_updates_type(): void
    {
        $service = new SubscriptionService();
        $user = User::factory()->create();
        $profile = $this->makeProfile($user, 'free');

        $updated = $service->changeSubscription($user, 'pro');
        $this->assertSame('pro', $updated->subscription_type);

        $updated = $service->changeSubscription($user, 'premium');
        $this->assertSame('premium', $updated->subscription_type);

        // Downgrade vers free : aucune annonce à purger, ne doit pas erreur.
        $updated = $service->changeSubscription($user, 'free');
        $this->assertSame('free', $updated->subscription_type);
    }

    public function test_has_reached_listing_limit_respects_unlimited_for_premium(): void
    {
        $service = new SubscriptionService();
        $premium = $this->makeProfile(User::factory()->create(), 'premium');

        $this->assertFalse($service->hasReachedListingLimit($premium));
    }

    public function test_deactivate_excess_free_listings_soft_deactivates_surplus(): void
    {
        $service = new SubscriptionService();
        $user = User::factory()->create();
        $profile = $this->makeProfile($user, 'free');

        $deactivated = Listing::withoutSyncingToSearch(function () use ($user, $profile, $service) {
            for ($i = 0; $i < 26; $i++) {
                Listing::create([
                    'user_id' => $user->id,
                    'title' => "Livre {$i}",
                    'book_condition' => 'occas',
                    'price' => 10,
                    'status' => 'published',
                ]);
            }

            // 26 annonces actives dépassent MAX_FREE_LISTINGS (25) -> limite atteinte.
            $this->assertTrue($service->hasReachedListingLimit($profile));

            return $service->deactivateExcessFreeListings($profile);
        });

        // 26 - 25 = 1 annonce excédentaire désactivée (soft).
        $this->assertSame(1, $deactivated);
        $this->assertDatabaseCount('listings', 26);
        $this->assertSame(
            1,
            Listing::where('user_id', $user->id)->where('status', 'inactive')->count()
        );
        $this->assertSame(
            25,
            Listing::where('user_id', $user->id)->where('status', 'published')->count()
        );
    }

    public function test_deactivate_excess_free_listings_unlimited_when_zero(): void
    {
        $service = new SubscriptionService();
        $user = User::factory()->create();
        $profile = $this->makeProfile($user, 'free');

        $result = Listing::withoutSyncingToSearch(function () use ($user, $profile, $service) {
            for ($i = 0; $i < 3; $i++) {
                Listing::create([
                    'user_id' => $user->id,
                    'title' => "Livre {$i}",
                    'book_condition' => 'occas',
                    'price' => 10,
                    'status' => 'published',
                ]);
            }

            return $service->deactivateExcessFreeListings($profile);
        });

        // MAX_FREE_LISTINGS vaut 25 par défaut : 3 annonces ne sont pas purgées.
        $this->assertSame(0, $result);
        $this->assertSame(
            3,
            Listing::where('user_id', $user->id)->where('status', 'published')->count()
        );
    }
}
