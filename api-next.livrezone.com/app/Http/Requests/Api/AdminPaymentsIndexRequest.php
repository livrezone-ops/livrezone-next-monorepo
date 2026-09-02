<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AdminPaymentsIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'status' => ['nullable', Rule::in(['all', 'pending', 'paid', 'failed'])],
            'type' => ['nullable', Rule::in(['all', 'pro', 'premium'])],
            'expiring' => 'nullable|boolean',
            'search' => 'nullable|string|max:100',
            'sort_by' => ['nullable', Rule::in(['created_at', 'expires_at', 'amount'])],
            'sort_dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'limit' => 'nullable|integer|min:1|max:100',
        ];
    }
}
