<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class AdminStoreHeroRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'messages' => 'required|array|min:1',
            'messages.*.id' => 'nullable|integer',
            'messages.*.language' => 'required|in:fr,ar',
            'messages.*.direction' => 'required|in:ltr,rtl',
            'messages.*.title' => 'required|string|max:255',
            'messages.*.description' => 'required|string|max:5000',
            'messages.*.primaryAction.label' => 'required|string|max:100',
            'messages.*.primaryAction.href' => 'required|string|max:255',
            'messages.*.secondaryAction.label' => 'nullable|string|max:100',
            'messages.*.secondaryAction.href' => 'nullable|string|max:255',
        ];
    }
}
