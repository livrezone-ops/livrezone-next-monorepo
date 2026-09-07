<?php

namespace App\Services\Referral;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;

/**
 * Réglages du programme de parrainage, éditables depuis l'admin.
 * Même mécanique que SubscriptionService::setting() (clé DB prioritaire,
 * repli .env, cache permanent invalidé à l'écriture) mais avec sa propre
 * allowlist : le parrainage n'a rien à faire dans la source de vérité des
 * abonnements, et setSetting() de SubscriptionService refuserait ces clés.
 */
class ReferralSettings
{
    /** Clé admin => variable .env de repli. */
    public const EDITABLE_SETTINGS = [
        'referral_enabled' => 'REFERRAL_ENABLED',
        'referral_filleul_bonus_days' => 'REFERRAL_FILLEUL_BONUS_DAYS',
        'referral_cookie_days' => 'REFERRAL_COOKIE_DAYS',
        'referral_min_account_age_hours' => 'REFERRAL_MIN_ACCOUNT_AGE_HOURS',
        'referral_max_visits_per_day' => 'REFERRAL_MAX_VISITS_PER_DAY',
        'referral_max_signups_per_day' => 'REFERRAL_MAX_SIGNUPS_PER_DAY',
        'referral_max_rewards_per_month' => 'REFERRAL_MAX_REWARDS_PER_MONTH',
        'referral_notify_admin' => 'REFERRAL_NOTIFY_ADMIN',
    ];

    public const DEFAULTS = [
        'referral_enabled' => false,
        'referral_filleul_bonus_days' => 0,
        'referral_cookie_days' => 30,
        'referral_min_account_age_hours' => 0,
        'referral_max_visits_per_day' => 100,
        'referral_max_signups_per_day' => 10,
        'referral_max_rewards_per_month' => 3,
        'referral_notify_admin' => true,
    ];

    public function isEnabled(): bool
    {
        return (bool) $this->get('referral_enabled');
    }

    public function cookieDays(): int
    {
        return max(1, min(90, (int) $this->get('referral_cookie_days')));
    }

    public function filleulBonusDays(): int
    {
        return max(0, (int) $this->get('referral_filleul_bonus_days'));
    }

    public function minAccountAgeHours(): int
    {
        return max(0, (int) $this->get('referral_min_account_age_hours'));
    }

    public function maxVisitsPerDay(): int
    {
        return max(0, (int) $this->get('referral_max_visits_per_day'));
    }

    public function maxSignupsPerDay(): int
    {
        return max(0, (int) $this->get('referral_max_signups_per_day'));
    }

    public function maxRewardsPerMonth(): int
    {
        return max(0, (int) $this->get('referral_max_rewards_per_month'));
    }

    public function notifyAdmin(): bool
    {
        return (bool) $this->get('referral_notify_admin');
    }

    /**
     * Valeurs courantes, pour le formulaire admin.
     */
    public function all(): array
    {
        $values = [];
        foreach (self::EDITABLE_SETTINGS as $key => $envKey) {
            $value = $this->get($key);
            $values[$key] = is_bool($value) ? (int) $value : $value;
        }

        return $values;
    }

    public function set(string $key, mixed $value): void
    {
        if (! array_key_exists($key, self::EDITABLE_SETTINGS)) {
            throw new \InvalidArgumentException("Réglage parrainage inconnu : {$key}");
        }

        $stored = is_bool($value) ? ($value ? '1' : '0') : (string) $value;

        Setting::updateOrCreate(['key' => $key], ['value' => $stored]);
        Cache::forget($this->cacheKey($key));
    }

    public function get(string $key): mixed
    {
        $default = self::DEFAULTS[$key] ?? null;

        return Cache::rememberForever($this->cacheKey($key), function () use ($key, $default) {
            try {
                $setting = Setting::find($key);
            } catch (\Throwable) {
                // Table settings absente (installation fraîche non migrée).
                return $default;
            }

            if ($setting !== null && $setting->value !== null && $setting->value !== '') {
                return $this->cast($key, $setting->value);
            }

            $envKey = self::EDITABLE_SETTINGS[$key];
            $raw = $envKey !== '' ? env($envKey, $default) : $default;

            return $this->cast($key, $raw);
        });
    }

    private function cast(string $key, mixed $value): mixed
    {
        if (in_array($key, ['referral_enabled', 'referral_notify_admin'], true)) {
            return filter_var($value, FILTER_VALIDATE_BOOLEAN);
        }

        if (in_array($key, [
            'referral_filleul_bonus_days',
            'referral_cookie_days',
            'referral_min_account_age_hours',
            'referral_max_visits_per_day',
            'referral_max_signups_per_day',
            'referral_max_rewards_per_month',
        ], true)) {
            return (int) $value;
        }

        return $value;
    }

    private function cacheKey(string $key): string
    {
        return "livrezone.setting.{$key}";
    }
}
