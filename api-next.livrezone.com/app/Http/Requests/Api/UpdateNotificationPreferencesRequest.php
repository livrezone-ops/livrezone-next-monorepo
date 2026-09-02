<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class UpdateNotificationPreferencesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Contrat : { channels: {email,telegram,whatsapp}, types: {<type>: bool},
     * categories: number[] }.
     */
    public function rules(): array
    {
        return [
            'channels' => 'required|array',
            'channels.email' => 'required|boolean',
            'channels.telegram' => 'required|boolean',
            'channels.whatsapp' => 'required|boolean',
            'types' => 'required|array',
            'types.*' => 'required|boolean',
            'categories' => 'present|array',
            'categories.*' => 'integer|exists:categories,id',
        ];
    }
}
