<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
use Throwable;

class SocialAuthController extends Controller
{
    /**
     * Retourne l'URL de redirection vers le provider (Google, etc.)
     */
    public function redirect(string $provider)
    {
        $url = Socialite::driver($provider)
            ->stateless()
            ->with(['prompt' => 'select_account'])
            ->redirect()
            ->getTargetUrl();

        return response()->json(['url' => $url]);
    }

    /**
     * Gère le retour du provider et redirige vers le Frontend Next.js
     */
    public function callback(string $provider)
    {
        try {
            $socialUser = Socialite::driver($provider)->stateless()->user();
        } catch (Throwable $e) {
            return redirect(env('FRONTEND_URL', 'http://localhost:3000') . '/login?error=auth_failed');
        }

        $user = User::where('provider', $provider)
            ->where('provider_id', $socialUser->getId())
            ->first();

        if ($user) {
            $this->ensureProfileExists($user, $socialUser);
            Auth::login($user);
            return redirect()->intended(env('FRONTEND_URL', 'http://localhost:3000') . ($user->profile_completed ? '/dashboard' : '/profile/complete'));
        }

        // Vérification email existant (même logique que l'ancien projet)
        $email = $socialUser->getEmail();
        if ($email && User::where('email', $email)->exists()) {
            return redirect(env('FRONTEND_URL', 'http://localhost:3000') . '/login?error=email_exists');
        }

        $user = User::create([
            'name' => $socialUser->getName() ?: $socialUser->getNickname() ?: 'User',
            'email' => $socialUser->getEmail(),
            'provider' => $provider,
            'provider_id' => $socialUser->getId(),
            'avatar' => $socialUser->getAvatar(),
            'password' => bcrypt(Str::random(24)),
        ]);

        $this->ensureProfileExists($user, $socialUser);

        Auth::login($user);

        return redirect()->intended(env('FRONTEND_URL', 'http://localhost:3000') . ($user->profile_completed ? '/dashboard' : '/profile/complete'));
    }

    public function logout()
    {
        Auth::guard('web')->logout();
        request()->session()->invalidate();
        request()->session()->regenerateToken();

        return response()->json(['message' => 'Déconnecté avec succès']);
    }

    // Garde la même logique métier robuste pour le profil
    protected function ensureProfileExists(User $user, $socialUser = null): void
    {
        // En mode API on crée une table "profiles" factice ou on s'assure qu'elle existe.
        // Comme vous utilisez la même BD, le modèle Profile fonctionnera.
        if ($user->profile()->exists()) return;

        $nickname = $socialUser
            ? ($socialUser->getName() ?: $socialUser->getNickname() ?: $user->name)
            : $user->name;

        $cityId = DB::table('cities')->where('name', 'Autre')->value('id');
        if (! $cityId) {
            $cityId = DB::table('cities')->insertGetId([
                'name' => 'Autre', 'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        $user->profile()->create([
            'city_id' => $cityId,
            'profile_type' => 'passionné(e)',
            'subscription_type' => 'free',
            'delivery_option' => 'selon destination',
            'nickname' => $nickname,
            'logo' => $user->avatar, 
        ]);
    }
}
