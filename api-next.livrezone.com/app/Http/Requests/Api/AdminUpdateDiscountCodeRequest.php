<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AdminUpdateDiscountCodeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'code' => 'sometimes|string|min:3|max:30|regex:/^[A-Za-z0-9_-]+$/',
            'type' => ['sometimes', Rule::in(['percent', 'fixed'])],
            'value' => 'sometimes|numeric|min:0.01',
            'is_active' => 'sometimes|boolean',
            'expires_at' => 'nullable|date',
            'max_uses' => 'nullable|integer|min:1',
        ];
    }
}
