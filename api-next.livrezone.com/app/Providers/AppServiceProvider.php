<?php

namespace App\Providers;

use App\Models\Listing;
use App\Observers\ListingObserver;
use App\Policies\ListingPolicy;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

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

        RateLimiter::for('catalogue', function (Request $request) {
            if (! config('livrezone.anti_scraping.enabled')) {
                return Limit::none();
            }

            return Limit::perMinute(config('livrezone.anti_scraping.max_requests_per_minute'))->by($request->ip());
        });
    }
}
