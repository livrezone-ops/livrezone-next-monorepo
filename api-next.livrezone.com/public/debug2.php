<?php
require __DIR__.'/../vendor/autoload.php';
 = require_once __DIR__.'/../bootstrap/app.php';
 = ->make(Illuminate\Contracts\Http\Kernel::class);
 = Illuminate\Http\Request::create('/api/dashboard/listings', 'GET', ['limit' => 100, 'filter' => 'all']);
// Mock Auth
 = App\Models\User::find(1);
->make('auth')->guard('sanctum')->setUser();
 = ->handle();
echo ->getContent();
