<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class CartMergeRequest extends FormRequest
{
    /**
     * Autorise uniquement les utilisateurs authentifiés.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Fusion des articles locaux (guests) d'un panier vers le compte connecté.
     * Reçoit une liste d'objets { listing_id, quantity }.
     *
     * Validation stricte -> 422 en cas d'échec.
     */
    public function rules(): array
    {
        return [
            'items' => [
                'required',
                'array',
                'max:200',
            ],
            'items.*.listing_id' => [
                'required',
                'integer',
                'distinct',
                'exists:listings,id',
            ],
            'items.*.quantity' => [
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
            'items.required' => 'Le panier est requis.',
            'items.array' => 'Le panier doit être une liste.',
            'items.max' => 'Le panier ne peut pas contenir plus de 200 articles.',
            'items.*.listing_id.required' => 'Chaque article doit avoir un identifiant d\'annonce.',
            'items.*.listing_id.integer' => 'Chaque identifiant d\'annonce doit être un entier.',
            'items.*.listing_id.distinct' => 'Les identifiants d\'annonces doivent être uniques.',
            'items.*.listing_id.exists' => 'Une des annonces sélectionnées n\'existe pas.',
            'items.*.quantity.integer' => 'La quantité doit être un entier.',
            'items.*.quantity.min' => 'La quantité doit être au moins 1.',
            'items.*.quantity.max' => 'La quantité ne peut pas dépasser 99.',
        ];
    }
}
