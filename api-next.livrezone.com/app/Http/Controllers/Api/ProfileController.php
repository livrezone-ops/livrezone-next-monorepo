<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\City;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Intervention\Image\Encoders\WebpEncoder;
use Intervention\Image\Laravel\Facades\Image;

class ProfileController extends Controller
{
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

    public function update(Request $request): JsonResponse
    {
        if ($request->filled('nickname')) {
            $request->merge([
                'nickname' => Str::slug($request->string('nickname')->toString()),
            ]);
        }

        $profile = $request->user()->profile;

        $validated = $request->validate([
            'phone' => ['nullable', 'regex:/^[0-9]{10}$/'],
            'city_id' => ['required', 'integer', 'exists:cities,id'],
            'profile_type' => [
                'required',
                Rule::in(['étudiant(e)', 'passionné(e)', 'librairie']),
            ],
            'subscription_type' => [
                'required',
                Rule::in(['free', 'premium']),
            ],
            'delivery_option' => [
                'required',
                Rule::in(['oui', 'non', 'selon destination']),
            ],
            'nickname' => [
                'required',
                'string',
                'max:255',
                Rule::unique('profiles', 'nickname')->ignore($profile?->id),
                Rule::notIn([
                    'login',
                    'register',
                    'dashboard',
                    'profile',
                    'admin',
                    'api',
                    'logout',
                    'password',
                ]),
            ],
            'adresse' => ['nullable', 'string', 'max:500'],
            'logo' => [
                'nullable',
                'image',
                'mimes:png,jpg,jpeg,gif,webp',
                'max:2048',
            ],
            'action' => ['required', Rule::in(['confirm', 'later'])],
        ]);

        $logoPath = $profile?->logo;

        if ($request->hasFile('logo')) {
            $directory = public_path('profile-logos');

            if (! is_dir($directory)) {
                mkdir($directory, 0755, true);
            }

            $filename = Str::random(12).'.webp';
            $relativePath = 'profile-logos/'.$filename;

            Image::decode($request->file('logo'))
                ->cover(200, 200)
                ->encode(new WebpEncoder(quality: 85))
                ->save(public_path($relativePath));

            $logoPath = '/'.$relativePath;
        }

        $profileData = [
            'phone' => $validated['phone'] ?? null,
            'city_id' => $validated['city_id'],
            'profile_type' => $validated['profile_type'],
            'subscription_type' => $validated['subscription_type'],
            'delivery_option' => $validated['delivery_option'],
            'nickname' => $validated['nickname'],
            'adresse' => $validated['adresse'] ?? null,
            'logo' => $logoPath ?: $request->user()->avatar,
        ];

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
}

