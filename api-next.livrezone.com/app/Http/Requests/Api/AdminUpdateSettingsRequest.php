<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class AdminUpdateSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'max_free_listings' => 'nullable|integer|min:0|max:10000',
            'pro_price' => 'nullable|numeric|min:0|max:100000',
            'premium_price' => 'nullable|numeric|min:0|max:100000',
            'notification_delay_hours' => 'nullable|integer|min:0|max:720',
            'subscription_grace_period_days' => 'nullable|integer|min:0|max:365',
            'subscriptions_disabled' => 'nullable|boolean',
            'telegram_pro_enabled' => 'nullable|boolean',
            'chat_digest_hours' => 'nullable|integer|min:1|max:168',
            'method_virement' => 'nullable|boolean',
            'method_especes' => 'nullable|boolean',
            'method_cheque' => 'nullable|boolean',
            'method_autre' => 'nullable|boolean',
            'gateway_cmi' => 'nullable|boolean',
            'gateway_fatourati' => 'nullable|boolean',
        ];
    }
}
