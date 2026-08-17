<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class WishlistMergeRequest extends FormRequest
{
    /**
     * Autorise uniquement les utilisateurs authentifiés.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Fusion des articles locaux (guests) d'une wishlist.
     * Reçoit un tableau d'identifiants d'annonces.
     *
     * Validation stricte -> 422 en cas d'échec.
     */
    public function rules(): array
    {
        return [
            'listing_ids' => [
                'required',
                'array',
                'max:200',
            ],
            'listing_ids.*' => [
                'required',
                'integer',
                'distinct',
                'exists:listings,id',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'listing_ids.required' => 'Le tableau d\'annonces est requis.',
            'listing_ids.array' => 'Le tableau d\'annonces doit être une liste.',
            'listing_ids.max' => 'La wishlist ne peut pas contenir plus de 200 annonces.',
            'listing_ids.*.integer' => 'Chaque identifiant d\'annonce doit être un entier.',
            'listing_ids.*.distinct' => 'Les identifiants d\'annonces doivent être uniques.',
            'listing_ids.*.exists' => 'Une des annonces sélectionnées n\'existe pas.',
        ];
    }
}
