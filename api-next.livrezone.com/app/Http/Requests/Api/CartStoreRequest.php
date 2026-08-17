<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CartStoreRequest extends FormRequest
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
                Rule::unique('cart_items', 'listing_id')
                    ->where('user_id', $this->user()->id),
            ],
            'quantity' => [
                'sometimes',
                'integer',
                'min:1',
                'max:99',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'listing_id.required' => 'L\'identifiant de l\'annonce est requis.',
            'listing_id.integer' => 'L\'identifiant de l\'annonce doit être un entier.',
            'listing_id.exists' => 'L\'annonce sélectionnée n\'existe pas.',
            'listing_id.unique' => 'Cette annonce est déjà dans votre panier.',
            'quantity.integer' => 'La quantité doit être un entier.',
            'quantity.min' => 'La quantité doit être au moins 1.',
            'quantity.max' => 'La quantité ne peut pas dépasser 99.',
        ];
    }
}
