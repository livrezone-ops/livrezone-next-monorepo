<?php

namespace App\Http\Requests\Api;

use App\Models\Profile;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Le pseudonyme est normalisé en slug avant validation
     * (ex-merge() dans le contrôleur).
     */
    protected function prepareForValidation(): void
    {
        if ($this->filled('nickname')) {
            $this->merge([
                'nickname' => Str::slug($this->string('nickname')->toString()),
            ]);
        }
    }

    /**
     * "later" garde les valeurs par défaut : on n'exige les champs
     * qu'à la confirmation définitive ("confirm").
     */
    public function rules(): array
    {
        $isConfirm = $this->input('action') === 'confirm';
        $profileId = $this->user()?->profile?->id;

        return [
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
                Rule::unique('profiles', 'nickname')->ignore($profileId),
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
        ];
    }
}
