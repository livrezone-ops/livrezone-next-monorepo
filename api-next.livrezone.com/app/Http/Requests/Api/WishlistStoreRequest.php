<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class WishlistStoreRequest extends FormRequest
{
    /**
     * Autorise uniquement les utilisateurs authentifiés.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Validation stricte -> 422 en cas d'échec.
     */
    public function rules(): array
    {
        return [
            'listing_id' => [
                'required',
                'integer',
                'exists:listings,id',
                Rule::unique('favorites', 'listing_id')
                    ->where('user_id', $this->user()->id),
            ],
        ];
    }

    /**
     * Messages d'erreur explicites en français.
     */
    public function messages(): array
    {
        return [
            'listing_id.required' => 'L\'identifiant de l\'annonce est requis.',
            'listing_id.integer' => 'L\'identifiant de l\'annonce doit être un entier.',
            'listing_id.exists' => 'L\'annonce sélectionnée n\'existe pas.',
            'listing_id.unique' => 'Cette annonce est déjà dans votre wishlist.',
        ];
    }
}
