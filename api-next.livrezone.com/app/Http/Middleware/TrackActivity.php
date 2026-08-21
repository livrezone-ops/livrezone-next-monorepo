<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class TrackActivity
{
    // Met à jour last_activity_at au plus une fois par minute par utilisateur
    // afin de limiter le nombre d'écritures en base.
    protected const THROTTLE_SECONDS = 60;

    public function handle(Request $request, Closure $next): Response
    {
        $user = Auth::guard('sanctum')->user();

        if ($user !== null && $this->shouldUpdate($user)) {
            DB::table('users')
                ->where('id', $user->getAuthIdentifier())
                ->update(['last_activity_at' => now()]);
        }

        return $next($request);
    }

    protected function shouldUpdate($user): bool
    {
        $last = $user->last_activity_at;

        return $last === null
            || $last->lt(now()->subSeconds(static::THROTTLE_SECONDS));
    }
}
