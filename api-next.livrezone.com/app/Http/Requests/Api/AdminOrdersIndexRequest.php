<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AdminOrdersIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'status' => ['nullable', Rule::in(['all', 'pending_admin', 'published', 'fulfilled', 'cancelled', 'rejected'])],
            'search' => 'nullable|string|max:100',
            'sort_by' => ['nullable', Rule::in(['created_at', 'title'])],
            'sort_dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'limit' => 'nullable|integer|min:1|max:100',
        ];
    }
}
