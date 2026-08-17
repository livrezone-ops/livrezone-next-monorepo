<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class CartDestroyRequest extends FormRequest
{
    /**
     * Autorise uniquement les utilisateurs authentifiés.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Retire un article du panier.
     * listing_id peut être fourni en query string (DELETE) ou en JSON body.
     *
     * Validation stricte -> 422 en cas d'échec.
     */
    public function rules(): array
    {
        return [
            'listing_id' => [
                'required',
                'integer',
                'exists:listings,id',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'listing_id.required' => 'L\'identifiant de l\'annonce est requis.',
            'listing_id.integer' => 'L\'identifiant de l\'annonce doit être un entier.',
            'listing_id.exists' => 'L\'annonce sélectionnée n\'existe pas.',
        ];
    }
}
