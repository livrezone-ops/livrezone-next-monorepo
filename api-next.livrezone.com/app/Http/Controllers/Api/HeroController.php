<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HeroMessage;

class HeroController extends Controller
{
    /**
     * Endpoint public : messages du hero (uniquement les actifs).
     * Forme alignée sur le type HeroMessage du frontend Next.js.
     */
    public function index()
    {
        return response()->json([
            'messages' => app(\App\Services\HeroMessageService::class)->getActiveMessages()
        ]);
    }
}