<?php

namespace App\Http\Requests\Api;

use App\Services\SubscriptionService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AdminUpdateUserSubscriptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'subscription_type' => ['required', Rule::in(SubscriptionService::TYPES)],
        ];
    }
}
