<?php

use App\Providers\AppServiceProvider;
use Laravel\Sanctum\SanctumServiceProvider;
use Laravel\Socialite\SocialiteServiceProvider;
use Laravel\Scout\ScoutServiceProvider;
use Laravel\Reverb\ReverbServiceProvider;

return [
    AppServiceProvider::class,
    SanctumServiceProvider::class,
    SocialiteServiceProvider::class,
    ScoutServiceProvider::class,
    ReverbServiceProvider::class,
];
