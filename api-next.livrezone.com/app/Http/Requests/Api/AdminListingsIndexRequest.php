<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AdminListingsIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'filter' => ['nullable', Rule::in(['all', 'online', 'offline', 'pending', 'archived', 'deleted'])],
            'search' => 'nullable|string|max:100',
            'sort_by' => ['nullable', Rule::in(['created_at', 'price', 'title'])],
            'sort_dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'limit' => 'nullable|integer|min:1|max:100',
        ];
    }
}
