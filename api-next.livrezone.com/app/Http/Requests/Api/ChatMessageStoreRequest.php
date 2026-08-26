<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class ChatMessageStoreRequest extends FormRequest
{
    /**
     * Autorise uniquement les utilisateurs authentifiés.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Validation stricte -> 422 en cas d'échec.
     */
    public function rules(): array
    {
        return [
            'message' => [
                'required',
                'string',
                'min:1',
                'max:2000',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'message.required' => 'Le message est requis.',
            'message.string' => 'Le message doit être une chaîne de caractères.',
            'message.min' => 'Le message ne peut pas être vide.',
            'message.max' => 'Le message ne peut pas dépasser 2000 caractères.',
        ];
    }
}
