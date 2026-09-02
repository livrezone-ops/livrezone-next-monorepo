<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class UpdatePasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Les comptes créés via Google n'ont pas de mot de passe :
     * current_password est alors facultatif (même règle conditionnelle
     * que l'ancien validate() inline du contrôleur).
     */
    public function rules(): array
    {
        $hasPassword = $this->user()?->password !== null;

        return [
            'current_password' => $hasPassword ? ['required', 'current_password'] : ['nullable'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ];
    }
}
