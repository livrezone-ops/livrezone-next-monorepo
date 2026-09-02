<?php

namespace App\Http\Requests\Api;

use App\Services\ListingQueryService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AdminBulkListingStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:listings,id',
            'action' => ['required', Rule::in(ListingQueryService::ADMIN_ACTIONS)],
        ];
    }
}
