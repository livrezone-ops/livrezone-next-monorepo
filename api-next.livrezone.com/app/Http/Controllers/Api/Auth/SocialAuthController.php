<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
use Throwable;

class SocialAuthController extends Controller
{
    /**
     * Durée de validité (minutes) d'une inscription provider en attente de
     * consentement CGV.
     */
    private const PENDING_TTL_MINUTES = 15;

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
            return redirect(config('app.frontend_url').'/login?error=auth_failed');
        }

        $user = User::where('provider', $provider)
            ->where('provider_id', $socialUser->getId())
            ->first();

        if ($user) {
            if (! $user->is_active) {
                return redirect(config('app.frontend_url').'/login?error=account_disabled');
            }

            $this->ensureProfileExists($user, $socialUser);
            $user->update(['last_login_at' => now()]);
            Auth::login($user);

            return redirect()->intended(config('app.frontend_url').($user->profile_completed ? '/dashboard' : '/profile/complete'));
        }

        // Vérification email existant (même logique que l'ancien projet)
        $email = $socialUser->getEmail();
        if ($email && User::where('email', $email)->exists()) {
            return redirect(config('app.frontend_url').'/login?error=email_exists');
        }

        // NOUVEAU UTILISATEUR : aucun enregistrement immédiat. Les données du
        // provider sont placées dans un jeton chiffré à durée limitée et le front
        // est renvoyé sur la page de consentement CGV (/auth/consent). Le compte
        // n'est créé qu'après acceptation (POST /auth/provider/consent) — sinon
        // rien n'est enregistré.
        $pending = [
            'provider' => $provider,
            'provider_id' => (string) $socialUser->getId(),
            'name' => $socialUser->getName() ?: $socialUser->getNickname() ?: 'User',
            'email' => $socialUser->getEmail(),
            'avatar' => $socialUser->getAvatar(),
            'expires_at' => now()->addMinutes(self::PENDING_TTL_MINUTES)->timestamp,
        ];

        $token = Crypt::encrypt($pending);

        return redirect(config('app.frontend_url').'/auth/consent?token='.urlencode($token));
    }

    /**
     * Aperçu de l'inscription provider en attente (avant consentement CGV).
     * Ne crée rien : lecture seule du jeton chiffré.
     */
    public function pendingConsent(Request $request)
    {
        $payload = $this->decryptPendingToken($request->query('token'));

        if ($payload === null) {
            return response()->json([
                'message' => "Demande d'inscription expirée ou invalide. Veuillez recommencer la connexion.",
            ], 410);
        }

        return response()->json([
            'provider' => $payload['provider'],
            'name' => $payload['name'],
            'email' => $payload['email'],
            'avatar' => $payload['avatar'],
        ]);
    }

    /**
     * Création effective du compte APRÈS acceptation des CGV. Sans acceptation
     * (ou jeton invalide/expiré), aucun utilisateur n'est enregistré.
     */
    public function acceptConsent(Request $request)
    {
        $request->validate([
            'token' => ['required', 'string'],
        ]);

        $payload = $this->decryptPendingToken($request->input('token'));

        if ($payload === null) {
            return response()->json([
                'message' => "Demande d'inscription expirée ou invalide. Veuillez recommencer la connexion via votre fournisseur.",
            ], 410);
        }

        // Re-vérification des comptes enregistrés : un compte a pu être créé
        // entre-temps avec le même provider_id ou la même adresse email.
        $exists = User::where('provider', $payload['provider'])
            ->where('provider_id', $payload['provider_id'])
            ->exists();
        if (! $exists && $payload['email']) {
            $exists = User::where('email', $payload['email'])->exists();
        }
        if ($exists) {
            return response()->json([
                'message' => 'Un compte existe déjà avec ces informations. Connectez-vous normalement.',
            ], 409);
        }

        $user = User::create([
            'name' => $payload['name'],
            'email' => $payload['email'],
            'provider' => $payload['provider'],
            'provider_id' => $payload['provider_id'],
            'avatar' => $payload['avatar'],
            'password' => bcrypt(Str::random(24)),
        ]);

        $this->ensureProfileExists($user);

        $user->update(['last_login_at' => now()]);

        Auth::guard('web')->login($user);

        return response()->json([
            'message' => 'Compte créé avec succès.',
            'user' => $user->fresh()->load('profile'),
            'redirect' => $user->profile_completed ? '/dashboard' : '/profile/complete',
        ]);
    }

    /**
     * Déchiffre et valide un jeton d'inscription en attente (signature APP_KEY
     * + expiration). Retourne null si invalide ou expiré.
     */
    protected function decryptPendingToken(?string $token): ?array
    {
        if (! $token) {
            return null;
        }

        try {
            $payload = Crypt::decrypt($token);
        } catch (Throwable $e) {
            return null;
        }

        if (! is_array($payload)
            || ! isset($payload['provider'], $payload['provider_id'], $payload['expires_at'])
            || ! is_numeric($payload['expires_at'])
            || (int) $payload['expires_at'] < now()->timestamp
        ) {
            return null;
        }

        return $payload;
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
        if ($user->profile()->exists()) {
            return;
        }

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
