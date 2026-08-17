<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CartUpdateRequest extends FormRequest
{
    /**
     * Autorise uniquement les utilisateurs authentifiés.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Met à jour la quantité d'un article du panier.
     * l'article est identifié par listing_id (body ou query).
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
                Rule::exists('cart_items', 'listing_id')
                    ->where('user_id', $this->user()->id),
            ],
            'quantity' => [
                'required',
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
            'listing_id.exists' => 'L\'annonce sélectionnée n\'est pas dans votre panier.',
            'quantity.required' => 'La quantité est requise.',
            'quantity.integer' => 'La quantité doit être un entier.',
            'quantity.min' => 'La quantité doit être au moins 1.',
            'quantity.max' => 'La quantité ne peut pas dépasser 99.',
        ];
    }
}
