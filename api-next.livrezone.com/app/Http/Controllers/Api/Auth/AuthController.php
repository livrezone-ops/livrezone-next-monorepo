<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Mail\ResetPasswordMail;
use App\Mail\VerifyEmailMail;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;

class AuthController extends Controller
{
    /**
     * Inscription classique (email + mot de passe).
     * Envoie un email de confirmation signé ; pas de connexion auto.
     */
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', PasswordRule::defaults()],
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => $validated['password'],
            'profile_completed' => false,
            'is_active' => true,
        ]);

        $this->ensureProfileExists($user);
        $this->sendVerificationEmail($user);

        return response()->json([
            'message' => 'Compte créé. Un email de confirmation vous a été envoyé.',
        ], 201);
    }

    /**
     * Connexion classique (email + mot de passe) via guard session (Sanctum SPA).
     */
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (! Auth::guard('web')->attempt($validated)) {
            return response()->json([
                'success' => false,
                'message' => 'Identifiants invalides.',
            ], 401);
        }

        $user = Auth::guard('web')->user();

        if (! $user->is_active) {
            Auth::guard('web')->logout();

            return response()->json([
                'message' => 'Compte désactivé.',
            ], 403);
        }

        $user->update(['last_login_at' => now()]);

        return response()->json([
            'message' => 'Connexion réussie.',
            'user' => $user->fresh()->load('profile'),
            'is_online' => $user->isOnline(),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Déconnecté avec succès.']);
    }

    /**
     * Renvoi de l'email de confirmation (ne révèle pas si le compte existe).
     */
    public function resendVerification(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $user = User::where('email', $validated['email'])->first();

        if ($user && $user->email_verified_at === null) {
            $this->sendVerificationEmail($user);
        }

        return response()->json([
            'message' => 'Si un compte existe, un email de confirmation a été envoyé.',
        ]);
    }

    /**
     * Lien signé depuis l'email : vérifie et redirige vers le frontend.
     */
    public function verifyEmail(Request $request, int $id, string $hash)
    {
        if (! $request->hasValidSignature()) {
            abort(403, 'Lien de vérification invalide ou expiré.');
        }

        $user = User::findOrFail($id);

        if (! hash_equals(sha1($user->email), $hash)) {
            abort(403, 'Lien de vérification invalide.');
        }

        if ($user->email_verified_at === null) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }

        return redirect()->away(
            rtrim(env('FRONTEND_URL', 'http://localhost:3000'), '/')
                .'/login?next=/profile/complete&verified=1'
        );
    }

    /**
     * Mot de passe oublié : génère un token et envoie le lien de reset.
     */
    public function forgotPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $user = User::where('email', $validated['email'])->first();

        if ($user) {
            $token = Password::getRepository()->create($user);
            $url = rtrim(env('FRONTEND_URL', 'http://localhost:3000'), '/')
                .'/reset-password?token='.$token
                .'&email='.urlencode($user->email);

            Mail::to($user->email)->send(new ResetPasswordMail($url, $user->name));
        }

        return response()->json([
            'message' => 'Si un compte existe, un lien de réinitialisation a été envoyé.',
        ]);
    }

    /**
     * Réinitialisation effective du mot de passe.
     */
    public function resetPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', PasswordRule::defaults()],
        ]);

        $status = Password::broker()->reset(
            [
                'email' => $validated['email'],
                'password' => $validated['password'],
                'password_confirmation' => $validated['password_confirmation'] ?? $validated['password'],
                'token' => $validated['token'],
            ],
            function (User $user, string $password) {
                $user->forceFill([
                    'password' => $password,
                    'remember_token' => Str::random(60),
                ])->save();
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json(['message' => 'Mot de passe réinitialisé avec succès.']);
        }

        return response()->json([
            'message' => 'Échec de la réinitialisation.',
            'error' => __($status),
        ], 422);
    }

    /**
     * Mise à jour du mot de passe depuis le profil.
     */
    public function updatePassword(Request $request): JsonResponse
    {
        $rules = [
            'password' => ['required', 'confirmed', PasswordRule::defaults()],
        ];

        if ($request->user()->password !== null) {
            $rules['current_password'] = ['required', 'current_password'];
        } else {
            // Pour les utilisateurs Google sans mot de passe, current_password peut être envoyé vide ou ne pas être là
            $rules['current_password'] = ['nullable'];
        }

        $validated = $request->validate($rules);

        $request->user()->update([
            'password' => $validated['password'],
        ]);

        return response()->json(['message' => 'Mot de passe mis à jour avec succès.']);
    }

    protected function sendVerificationEmail(User $user): void
    {
        $url = URL::temporarySignedRoute(
            'verification.verify',
            now()->addHours(24),
            ['id' => $user->id, 'hash' => sha1($user->email)]
        );

        Mail::to($user->email)->send(new VerifyEmailMail($url, $user->name));
    }

    /**
     * Crée un profil par défaut (même logique que SocialAuthController).
     */
    protected function ensureProfileExists(User $user): void
    {
        if ($user->profile()->exists()) {
            return;
        }

        $cityId = DB::table('cities')->where('name', 'Autre')->value('id');

        if (! $cityId) {
            $cityId = DB::table('cities')->insertGetId([
                'name' => 'Autre',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $user->profile()->create([
            'city_id' => $cityId,
            'profile_type' => 'passionné(e)',
            'subscription_type' => 'free',
            'delivery_option' => 'selon destination',
            'nickname' => $user->name,
            'logo' => $user->avatar,
        ]);
    }
}
