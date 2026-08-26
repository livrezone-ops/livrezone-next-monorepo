<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\City;
use App\Models\Profile;
use App\Models\Rating;
use App\Services\ImageUploadService;
use App\Services\NotificationPreferenceService;
use App\Services\RatingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ProfileController extends Controller
{
    /**
     * Affichage public d'une bibliothèque vendeur (page profil).
     * Renvoie le profil + compteur d'annonces publiées.
     */
    public function publicLibrary(string $nickname): JsonResponse
    {
        $profile = Profile::query()
            ->with(['user', 'city'])
            ->where('nickname', $nickname)
            ->first();

        if (! $profile) {
            return response()->json(['message' => 'Profil introuvable.'], 404);
        }

        $listingCount = (int) $profile->listing_count;

        return response()->json([
            'data' => [
                'user_id' => $profile->user_id,
                'nickname' => $profile->nickname,
                'profile_type' => $profile->profile_type,
                'logo' => $profile->logo,
                'adresse' => $profile->adresse,
                'phone' => $profile->phone,
                'has_whatsapp' => (bool) ($profile->has_whatsapp ?? true),
                'delivery_option' => $profile->delivery_option ?? 'selon destination',
                'rating_average' => (float) $profile->rating_average,
                'rating_count' => (int) $profile->rating_count,
                'listing_count' => $listingCount,
                'city' => $profile->city ? ['id' => $profile->city->id, 'name' => $profile->city->name] : null,
            ],
        ]);
    }

    /**
     * Liste publique des avis d'un vendeur (page profil).
     */
    public function ratings(string $nickname): JsonResponse
    {
        $profile = Profile::query()
            ->where('nickname', $nickname)
            ->first();

        if (! $profile) {
            return response()->json(['message' => 'Profil introuvable.'], 404);
        }

        $ratings = Rating::with(['user:id,name,avatar', 'user.profile:id,user_id,nickname'])
            ->where('profile_id', $profile->id)
            ->latest()
            ->paginate(10);

        return response()->json([
            'data' => $ratings->items(),
            'meta' => [
                'current_page' => $ratings->currentPage(),
                'last_page' => $ratings->lastPage(),
                'total' => $ratings->total(),
                'rating_average' => (float) $profile->rating_average,
                'rating_count' => (int) $profile->rating_count,
            ],
        ]);
    }

    /**
     * Enregistre ou met à jour l'avis d'un acheteur sur un vendeur.
     */
    public function storeRating(Request $request, string $nickname, RatingService $ratingService): JsonResponse
    {
        $profile = Profile::query()
            ->where('nickname', $nickname)
            ->first();

        if (! $profile) {
            return response()->json(['message' => 'Profil introuvable.'], 404);
        }

        $validated = $request->validate([
            'score' => 'required|integer|min:1|max:5',
            'comment' => 'nullable|string|max:1000',
        ]);

        $rating = $ratingService->storeRating(
            $request->user(),
            $profile,
            $validated['score'],
            $validated['comment'] ?? null
        );

        return response()->json([
            'message' => 'Merci pour votre avis !',
            'rating' => $rating,
            'rating_average' => (float) $profile->rating_average,
            'rating_count' => (int) $profile->rating_count,
        ]);
    }

    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $request->user(),
            'profile' => $request->user()->profile,
            'cities' => City::query()
                ->orderBy('name')
                ->get(['id', 'name']),
        ]);
    }

    public function update(Request $request, ImageUploadService $imageUploadService): JsonResponse
    {
        if ($request->filled('nickname')) {
            $request->merge([
                'nickname' => Str::slug($request->string('nickname')->toString()),
            ]);
        }

        $profile = $request->user()->profile;

        // "later" garde les valeurs par défaut : on n'exige les champs
        // qu'à la confirmation définitive ("confirm").
        $isConfirm = $request->input('action') === 'confirm';

        $validated = $request->validate([
            'phone' => ['nullable', 'regex:/^[0-9]{10}$/'],
            'has_whatsapp' => ['nullable', 'boolean'],
            'city_id' => [
                Rule::requiredIf($isConfirm),
                'nullable',
                'integer',
                'exists:cities,id',
            ],
            'profile_type' => [
                Rule::requiredIf($isConfirm),
                'nullable',
                Rule::in(['étudiant(e)', 'passionné(e)', 'librairie']),
            ],

            'profile_book_conditions' => [
                'required',
                Rule::in(['neuf', 'occas']),
            ],

            'delivery_option' => [
                Rule::requiredIf($isConfirm),
                'nullable',
                Rule::in(['oui', 'non', 'selon destination']),
            ],
            'nickname' => [
                Rule::requiredIf($isConfirm),
                'nullable',
                'string',
                'max:255',
                Rule::unique('profiles', 'nickname')->ignore($profile?->id),
                Rule::notIn(Profile::RESERVED_NICKNAMES),
            ],
            'adresse' => ['nullable', 'string', 'max:500'],
            'avatar_mode' => ['nullable', Rule::in(['google', 'initials', 'custom'])],
            'logo' => [
                'nullable',
                'image',
                'mimes:png,jpg,jpeg,gif,webp',
                'max:2048',
            ],
            'action' => ['required', Rule::in(['confirm', 'later'])],
        ]);

        $avatarMode = $validated['avatar_mode'] ?? null;
        $logoPath = $profile?->logo;
        $avatarUpload = $profile?->avatar_upload;

        if ($avatarMode === 'google') {
            // Avatar récupéré depuis le provider (Google / réseau social).
            // Jamais utilisé en dehors du mode google explicitement choisi.
            $logoPath = $request->user()->avatar ?: $logoPath;
        } elseif ($avatarMode === 'initials') {
            // Avatar généré à partir du pseudonyme (rendu côté frontend).
            $logoPath = null;
        } elseif ($request->hasFile('logo')) {
            // Upload personnalisé via ImageUploadService
            $relativePath = $imageUploadService->storeImage(
                $request->file('logo'),
                'profiles/logos',
                160,
                160,
                90
            );

            $logoPath = '/storage/'.$relativePath;
            // Conserve le dernier logo importé pour pouvoir y revenir.
            $avatarUpload = $logoPath;
        } elseif ($avatarMode === 'custom') {
            // Réactive un logo précédemment importé si l'utilisateur n'en
            // upload pas un nouveau.
            if ($avatarUpload) {
                $logoPath = $avatarUpload;
            }
        }
        $hasWhatsapp = null;
        if ($request->has('has_whatsapp')) {
            $hasWhatsapp = filter_var($request->input('has_whatsapp'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($hasWhatsapp === null && ($request->input('has_whatsapp') === '1' || $request->input('has_whatsapp') === 1)) {
                $hasWhatsapp = true;
            } elseif ($hasWhatsapp === null && ($request->input('has_whatsapp') === '0' || $request->input('has_whatsapp') === 0)) {
                $hasWhatsapp = false;
            }
        }

        $profileData = [
            'phone' => $validated['phone'] ?? null,
            'city_id' => $validated['city_id'],
            'profile_type' => $validated['profile_type'],
            'profile_book_conditions' => $validated['profile_book_conditions'] ?? null,

            'delivery_option' => $validated['delivery_option'],
            'nickname' => $validated['nickname'],
            'adresse' => $validated['adresse'] ?? null,
            'logo' => $logoPath,
            'avatar_mode' => $avatarMode,
            'avatar_upload' => $avatarUpload,
        ];

        if ($hasWhatsapp !== null) {
            $profileData['has_whatsapp'] = $hasWhatsapp;
        }

        $profile = $request->user()
            ->profile()
            ->updateOrCreate(
                ['user_id' => $request->user()->id],
                $profileData
            );

        if ($validated['action'] === 'confirm') {
            $request->user()->update([
                'profile_completed' => true,
            ]);
        }

        return response()->json([
            'message' => $validated['action'] === 'confirm'
                ? 'Profil complété avec succès.'
                : 'Profil enregistré.',
            'user' => $request->user()->fresh()->load('profile'),
            'profile' => $profile->fresh()->load('city'),
        ]);
    }

    public function getNotificationPreferences(Request $request): JsonResponse
    {
        $prefs = app(NotificationPreferenceService::class)->getForUser($request->user()->id);

        return response()->json(['preferences' => $prefs]);
    }

    public function updateNotificationPreferences(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'preferences' => 'required|array',
            'preferences.*.notification_type' => 'required|string|in:'.implode(',', NotificationPreferenceService::ALLOWED_TYPES),
            'preferences.*.channel' => 'required|string|in:'.implode(',', NotificationPreferenceService::ALLOWED_CHANNELS),
            'preferences.*.is_enabled' => 'required|boolean',
            'preferences.*.filters' => 'nullable|array',
        ]);

        $prefs = app(NotificationPreferenceService::class)
            ->updateForUser($request->user()->id, $validated['preferences']);

        return response()->json([
            'message' => 'Préférences mises à jour avec succès.',
            'preferences' => $prefs,
        ]);
    }

    /**
     * Génère un token de liaison Telegram et renvoie le deep link /start <token>.
     */
    public function generateTelegramLink(Request $request): JsonResponse
    {
        if (! config('services.telegram.enabled', false)) {
            return response()->json(['message' => 'La liaison Telegram est désactivée.'], 422);
        }

        $botUsername = config('services.telegram.bot_username');
        if (! $botUsername) {
            return response()->json(['message' => 'Configuration Telegram incomplète.'], 422);
        }

        $profile = $request->user()->profile;

        if (! $profile) {
            return response()->json(['message' => 'Profil introuvable.'], 404);
        }

        $token = Str::random(40);
        $profile->update([
            'telegram_link_token' => $token,
            'telegram_link_token_expires_at' => now()->addMinutes(30),
        ]);

        return response()->json([
            'linked' => ! empty($profile->telegram_id),
            'deep_link' => "https://t.me/{$botUsername}?start={$token}",
            'token_expires_at' => $profile->telegram_link_token_expires_at?->toIso8601String(),
        ]);
    }

    /**
     * Retire la liaison Telegram du profil courant.
     */
    public function unlinkTelegram(Request $request): JsonResponse
    {
        $profile = $request->user()->profile;

        if (! $profile) {
            return response()->json(['message' => 'Profil introuvable.'], 404);
        }

        $profile->update([
            'telegram_id' => null,
            'telegram_link_token' => null,
            'telegram_link_token_expires_at' => null,
            'telegram_linked_at' => null,
        ]);

        return response()->json(['message' => 'Telegram délié avec succès.', 'linked' => false]);
    }
}
