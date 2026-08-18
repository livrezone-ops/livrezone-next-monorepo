<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class ChatThreadStoreRequest extends FormRequest
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
            'user_id' => [
                'required',
                'integer',
                'exists:users,id',
                'not_in:' . $this->user()->id,
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'user_id.required' => 'L\'identifiant de l\'interlocuteur est requis.',
            'user_id.integer' => 'L\'identifiant de l\'interlocuteur doit être un entier.',
            'user_id.exists' => 'Cet utilisateur n\'existe pas.',
            'user_id.not_in' => 'Vous ne pouvez pas discuter avec vous-même.',
        ];
    }
}