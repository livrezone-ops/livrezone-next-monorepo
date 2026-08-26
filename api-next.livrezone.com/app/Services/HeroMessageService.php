<?php

namespace App\Services;

use App\Models\HeroMessage;
use Illuminate\Support\Facades\Cache;

class HeroMessageService
{
    /**
     * Get active hero messages, cached for 24 hours.
     */
    public function getActiveMessages(): array
    {
        $ttl = config('livrezone.cache_ttl.hero_messages', 86400);

        return Cache::remember('hero_messages_active', $ttl, function () {
            return HeroMessage::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->get()
                ->map(fn (HeroMessage $m) => $m->toHeroMessageShape())
                ->values()
                ->toArray();
        });
    }
}
