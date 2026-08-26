<?php

use App\Providers\AppServiceProvider;
use Laravel\Reverb\ReverbServiceProvider;
use Laravel\Sanctum\SanctumServiceProvider;
use Laravel\Scout\ScoutServiceProvider;
use Laravel\Socialite\SocialiteServiceProvider;

return [
    AppServiceProvider::class,
    SanctumServiceProvider::class,
    SocialiteServiceProvider::class,
    ScoutServiceProvider::class,
    ReverbServiceProvider::class,
];
