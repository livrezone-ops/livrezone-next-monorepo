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

        // Anti brute-force (login) et anti bombing/énumération (forgot-password).
        // Clé = email + IP : sans trustProxies configuré (chaîne Cloudflare → Caddy →
        // php-fpm), l'IP vue par Laravel est celle du proxy et est partagée par tous
        // les clients — une limite par IP seule verrouillerait collectivement tout le
        // site. La clé email+IP ne bride que les tentatives visant un compte précis
        // (5 tentatives/min). Une limite par IP seule ne sera envisageable qu'après
        // configuration de trustProxies (décision propriétaire, cf. .agents/AGENTS.md).
        RateLimiter::for('auth', function (Request $request) {
            return Limit::perMinute(5)->by($request->string('email').'|'.$request->ip());
        });
    }
}
