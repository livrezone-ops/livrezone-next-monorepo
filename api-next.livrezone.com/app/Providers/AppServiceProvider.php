<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Gate;
use App\Models\Listing;
use App\Observers\ListingObserver;
use App\Policies\ListingPolicy;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::policy(Listing::class, ListingPolicy::class);

        Listing::observe(ListingObserver::class);

        \Illuminate\Support\Facades\RateLimiter::for('catalogue', function (\Illuminate\Http\Request $request) {
            if (!config('livrezone.anti_scraping.enabled')) {
                return \Illuminate\Cache\RateLimiting\Limit::none();
            }
            return \Illuminate\Cache\RateLimiting\Limit::perMinute(config('livrezone.anti_scraping.max_requests_per_minute'))->by($request->ip());
        });
    }
}
