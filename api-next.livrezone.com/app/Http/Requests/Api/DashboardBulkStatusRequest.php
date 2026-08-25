<?php

namespace App\Http\Requests\Api;

use App\Services\ListingQueryService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DashboardBulkStatusRequest extends FormRequest
{
    /**
     * Le périmètre (annonces du vendeur) est forcé côté service via
     * l'utilisateur authentifié ; aucun id transmis par la requête n'est
     * de confiance.
     */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer|exists:listings,id',
            // Un vendeur ne peut jamais publier/valider : statuts limités.
            'status' => ['required', Rule::in(ListingQueryService::SELLER_STATUSES)],
        ];
    }
}
