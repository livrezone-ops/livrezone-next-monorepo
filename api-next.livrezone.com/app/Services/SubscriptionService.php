<?php

namespace App\Services;

use App\Models\Listing;
use App\Models\Payment;
use App\Models\Profile;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Source de vérité unique pour la gestion des abonnements :
 * éligibilité aux notifications, visibilité des demandes, limites de publications,
 * prix, expiration et changement de profil (upgrade/downgrade).
 *
 * Toute la logique auparavant en dur (PROMO_PRO_FREE, MAX_FREE_LISTINGS,
 * PRO_NOTIFICATION_DELAY_HOURS, etc.) est centralisée ici.
 */
class SubscriptionService
{
    public const TYPES = ['free', 'pro', 'premium'];

    public const PROMO_CACHE_KEY = 'livrezone.promo_pro_free';
    public const PROMO_SETTING_KEY = 'promo_pro_free';

    /** Réglages modifiables depuis l'admin : clé de réglage => clé .env de repli. */
    public const EDITABLE_SETTINGS = [
        'max_free_listings' => 'MAX_FREE_LISTINGS',
        'pro_price' => 'PRO_PRICE',
        'premium_price' => 'PREMIUM_PRICE',
        'pro_price_yearly' => 'PRO_PRICE_YEARLY',
        'premium_price_yearly' => 'PREMIUM_PRICE_YEARLY',
        'notification_delay_hours' => 'PRO_NOTIFICATION_DELAY_HOURS',
        'subscription_grace_period_days' => 'SUBSCRIPTION_GRACE_PERIOD_DAYS',
        'subscriptions_disabled' => 'SUBSCRIPTIONS_DISABLED',
        'method_virement' => 'PAYMENT_METHOD_VIREMENT',
        'method_especes' => 'PAYMENT_METHOD_ESPECES',
        'method_cheque' => 'PAYMENT_METHOD_CHEQUE',
        'method_autre' => 'PAYMENT_METHOD_AUTRE',
    ];

    /**
     * Inscriptions Pro/Premium bloquées momentanément par l'admin ?
     */
    public function areSubscriptionsDisabled(): bool
    {
        return (bool) $this->setting('subscriptions_disabled', 'SUBSCRIPTIONS_DISABLED', false);
    }

    /**
     * Moyens de paiement manuels activés par l'admin
     * (les passerelles en ligne sont gérées séparément via PaymentGatewayService).
     *
     * @return string[]
     */
    public function enabledPaymentMethods(): array
    {
        $methods = [
            'virement' => 'method_virement',
            'especes' => 'method_especes',
            'cheque' => 'method_cheque',
            'autre' => 'method_autre',
        ];

        return collect($methods)
            ->filter(fn ($settingKey) => (bool) $this->setting($settingKey, self::EDITABLE_SETTINGS[$settingKey], true))
            ->keys()
            ->values()
            ->all();
    }

    /**
     * Lit un réglage : valeur admin (DB, prioritaire) sinon variable d'environnement.
     * Mise en cache permanente, invalidée à chaque écriture.
     * Tolérante à l'absence de la table settings (installation fraîche non migrée).
     */
    public function setting(string $key, string $envKey, mixed $default): mixed
    {
        return \Illuminate\Support\Facades\Cache::rememberForever("livrezone.setting.{$key}", function () use ($key, $envKey, $default) {
            try {
                $setting = \App\Models\Setting::find($key);
            } catch (\Throwable) {
                return $default;
            }

            if ($setting !== null && $setting->value !== null && $setting->value !== '') {
                return $setting->value;
            }

            return env($envKey, $default);
        });
    }

    /**
     * Écrit un réglage admin (effet immédiat, persiste aux déploiements).
     */
    public function setSetting(string $key, mixed $value): void
    {
        if (! array_key_exists($key, self::EDITABLE_SETTINGS)) {
            throw new \InvalidArgumentException("Réglage non éditable : {$key}");
        }

        \App\Models\Setting::updateOrCreate(['key' => $key], ['value' => (string) $value]);
        \Illuminate\Support\Facades\Cache::forget("livrezone.setting.{$key}");
        // /reference-data (page tarification) embarque prix et délais : invalider.
        \Illuminate\Support\Facades\Cache::forget('reference_data');
    }

    /**
     * Valeurs courantes des réglages éditables (pour l'UI admin).
     */
    public function getEditableSettings(): array
    {
        return [
            'max_free_listings' => $this->getMaxFreeListings(),
            'pro_price' => $this->getProPrice(),
            'premium_price' => $this->getPremiumPrice(),
            'pro_price_yearly' => $this->getProPriceYearly(),
            'premium_price_yearly' => $this->getPremiumPriceYearly(),
            'notification_delay_hours' => $this->getNotificationDelayHours(),
            'subscription_grace_period_days' => $this->getGracePeriodDays(),
            'subscriptions_disabled' => (int) $this->areSubscriptionsDisabled(),
            'method_virement' => (int) in_array('virement', $this->enabledPaymentMethods(), true),
            'method_especes' => (int) in_array('especes', $this->enabledPaymentMethods(), true),
            'method_cheque' => (int) in_array('cheque', $this->enabledPaymentMethods(), true),
            'method_autre' => (int) in_array('autre', $this->enabledPaymentMethods(), true),
        ];
    }

    /**
     * Prix annuel Pro (2 mois offerts par défaut = 10x le mensuel).
     */
    public function getProPriceYearly(): float
    {
        return $this->yearlyPrice('pro_price_yearly', 'PRO_PRICE_YEARLY', $this->getProPrice());
    }

    /**
     * Prix annuel Premium (2 mois offerts par défaut = 10x le mensuel).
     */
    public function getPremiumPriceYearly(): float
    {
        return $this->yearlyPrice('premium_price_yearly', 'PREMIUM_PRICE_YEARLY', $this->getPremiumPrice());
    }

    private function yearlyPrice(string $key, string $envKey, float $monthlyPrice): float
    {
        $value = (float) $this->setting($key, $envKey, 0);

        // 0 ou non défini : calculé depuis le mensuel (10 mois = 2 mois offerts).
        return $value > 0 ? $value : round($monthlyPrice * 10, 2);
    }

    /**
     * Promo « Pro offert pour les free » : pilotée depuis l'admin (persistée
     * en DB, mise en cache pour la perf), avec repli sur la variable
     * d'environnement si aucun réglage n'a jamais été enregistré.
     */
    public function isPromoProFree(): bool
    {
        return \Illuminate\Support\Facades\Cache::rememberForever(self::PROMO_CACHE_KEY, function () {
            try {
                $setting = \App\Models\Setting::find(self::PROMO_SETTING_KEY);
            } catch (\Throwable) {
                $setting = null;
            }

            if ($setting !== null) {
                return filter_var($setting->value, FILTER_VALIDATE_BOOLEAN);
            }

            return filter_var(env('PROMO_PRO_FREE', false), FILTER_VALIDATE_BOOLEAN);
        });
    }

    /**
     * Active/désactive la promo Pro gratuit (admin).
     * Persistance en DB (survit aux déploiements) + invalidation du cache
     * (effet immédiat, sans artisan ni déploiement).
     */
    public function setPromoProFree(bool $active): void
    {
        \App\Models\Setting::updateOrCreate(
            ['key' => self::PROMO_SETTING_KEY],
            ['value' => $active ? '1' : '0']
        );

        \Illuminate\Support\Facades\Cache::forget(self::PROMO_CACHE_KEY);
        // La page tarification lit la promo via /reference-data (cache 24 h).
        \Illuminate\Support\Facades\Cache::forget('reference_data');
    }

    /**
     * Abonnement effectif en tenant compte de la promo (free traité comme pro).
     */
    public function getEffectiveSubscription(?Profile $profile): string
    {
        $base = $profile->subscription_type ?? 'free';

        if ($this->isPromoProFree() && $base === 'free') {
            return 'pro';
        }

        return $base;
    }

    public function canReceiveNotifications(?Profile $profile): bool
    {
        return $this->getEffectiveSubscription($profile) !== 'free';
    }

    /**
     * Canaux de notification autorisés selon l'abonnement.
     * Pro     : in-app (database) uniquement.
     * Premium : in-app + email + telegram.
     */
    public function allowedNotificationChannels(?Profile $profile): array
    {
        return $this->getEffectiveSubscription($profile) === 'premium'
            ? ['mail', 'database', 'telegram']
            : ['database'];
    }

    public function canViewDemandes(?Profile $profile): bool
    {
        return $this->getEffectiveSubscription($profile) !== 'free';
    }

    public function getNotificationDelayHours(): int
    {
        return (int) $this->setting('notification_delay_hours', 'PRO_NOTIFICATION_DELAY_HOURS', 3);
    }

    /**
     * Seuil de visibilité des demandes pour le viewer.
     * Pro     : published_at <= now - délai.
     * Premium : null (aucun seuil).
     */
    public function getDemandesVisibilityThreshold(?Profile $profile): ?Carbon
    {
        if ($this->getEffectiveSubscription($profile) === 'pro') {
            return now()->subHours($this->getNotificationDelayHours());
        }

        return null;
    }

    public function getMaxFreeListings(): int
    {
        return (int) $this->setting('max_free_listings', 'MAX_FREE_LISTINGS', 25);
    }

    /**
     * Nombre maximum d'annonces actives. 0 = illimité.
     * Free est limité par MAX_FREE_LISTINGS (0 = illimité).
     * Pro / Premium = illimité.
     */
    public function getMaxListings(?Profile $profile): int
    {
        if ($this->getEffectiveSubscription($profile) === 'free') {
            return $this->getMaxFreeListings();
        }

        return 0;
    }

    public function hasReachedListingLimit(?Profile $profile): bool
    {
        $max = $this->getMaxListings($profile);

        if ($max <= 0) {
            return false;
        }

        $userId = $profile?->user_id;
        if (!$userId) {
            return false;
        }

        $activeCount = Listing::where('user_id', $userId)
            ->whereIn('status', ['published', 'pending_admin'])
            ->count();

        return $activeCount >= $max;
    }

    /**
     * Types d'abonnement éligibles à la réception de notifications
     * (inclut 'free' si la promo est active).
     */
    public function notifiableSubscriptionTypes(): array
    {
        return $this->isPromoProFree()
            ? ['free', 'pro', 'premium']
            : ['pro', 'premium'];
    }

    public function getProPrice(): float
    {
        return (float) $this->setting('pro_price', 'PRO_PRICE', 30);
    }

    public function getPremiumPrice(): float
    {
        return (float) $this->setting('premium_price', 'PREMIUM_PRICE', 50);
    }

    /**
     * Délai de grâce (jours) avant de masquer les annonces excédentaires
     * d'un compte repassé à Free après expiration de son abonnement.
     */
    public function getGracePeriodDays(): int
    {
        return (int) $this->setting('subscription_grace_period_days', 'SUBSCRIPTION_GRACE_PERIOD_DAYS', 15);
    }

    /**
     * Désactive (soft, status = 'hidden') les annonces actives excédentaires
     * d'un profil Free au-delà de MAX_FREE_LISTINGS (0 = illimité, aucune action).
     * Partagé entre le downgrade manuel et le traitement planifié des expirations.
     * Retourne le nombre d'annonces désactivées.
     */
    public function deactivateExcessFreeListings(Profile $profile): int
    {
        $maxFreeListings = $this->getMaxFreeListings();

        if ($maxFreeListings <= 0) {
            return 0;
        }

        $activeListings = Listing::where('user_id', $profile->user_id)
            ->whereIn('status', ['published', 'pending_admin'])
            ->orderByDesc('updated_at')
            ->get();

        $deactivated = 0;
        if ($activeListings->count() > $maxFreeListings) {
            foreach ($activeListings->slice($maxFreeListings) as $listing) {
                $listing->update(['status' => 'hidden']);
                $deactivated++;
            }
        }

        return $deactivated;
    }

    /**
     * Changement de profil par l'admin (upgrade / downgrade).
     */
    public function changeSubscription(User $user, string $type): Profile
    {
        if (!in_array($type, self::TYPES, true)) {
            throw new \InvalidArgumentException("Type d'abonnement invalide : {$type}");
        }

        $profile = $user->profile;

        if (!$profile) {
            throw new \RuntimeException('Profil introuvable pour cet utilisateur.');
        }

        $profile->update(['subscription_type' => $type]);

        // Downgrade vers Free : purge immédiate des annonces excédentaires
        // (soft-desactivation). La limite 0 = illimité ne purge rien.
        if ($type === 'free') {
            $this->deactivateExcessFreeListings($profile);
        }

        return $profile->fresh();
    }

    /**
     * Désactivation temporaire par l'admin : bascule en Free en mémorisant
     * l'offre d'origine (paused_from_type) pour permettre la reprise.
     * Les annonces excédentaires sont masquées, comme après un downgrade.
     */
    public function pauseSubscription(User $user): Profile
    {
        $profile = $user->profile;

        if (! $profile) {
            throw new \RuntimeException('Profil introuvable pour cet utilisateur.');
        }

        if ($profile->subscription_type === 'free') {
            throw ValidationException::withMessages([
                'status' => 'Cet utilisateur est déjà sur le plan gratuit.',
            ]);
        }

        $profile->update([
            'paused_from_type' => $profile->subscription_type,
            'paused_at' => now(),
            'subscription_type' => 'free',
        ]);

        $this->deactivateExcessFreeListings($profile->fresh());

        return $profile->fresh();
    }

    /**
     * Reprise d'un abonnement mis en pause : restaure l'offre d'origine
     * si le paiement sous-jacent est encore valide.
     */
    public function resumeSubscription(User $user): Profile
    {
        $profile = $user->profile;

        if (! $profile || ! $profile->paused_from_type) {
            throw ValidationException::withMessages([
                'status' => 'Aucun abonnement en pause pour cet utilisateur.',
            ]);
        }

        $lastPayment = $this->getLatestPaidPayment($user->id);

        if (! $lastPayment || ! $lastPayment->expires_at || Carbon::parse($lastPayment->expires_at)->isPast()) {
            // Offre sous-jacente expirée pendant la pause : reprise impossible,
            // l'utilisateur doit repasser par un nouveau paiement.
            throw ValidationException::withMessages([
                'status' => 'Le paiement sous-jacent a expiré. Reprenez via un nouveau paiement.',
            ]);
        }

        $profile->update([
            'subscription_type' => $profile->paused_from_type,
            'paused_from_type' => null,
            'paused_at' => null,
        ]);

        return $profile->fresh();
    }

    /**
     * Traitement des expirations : rétrogradation des comptes dont le
     * paiement est expiré, puis purge des annonces excédentaires après
     * le délai de grâce. (Anciennement dans ProcessExpiredSubscriptions.)
     */
    public function processExpirations(): void
    {
        $gracePeriodDays = $this->getGracePeriodDays();

        $activeProfiles = Profile::whereIn('subscription_type', ['pro', 'premium'])->get();
        foreach ($activeProfiles as $profile) {
            $lastPayment = $this->getLatestPaidPayment($profile->user_id);

            if (!$lastPayment || Carbon::parse($lastPayment->expires_at)->isPast()) {
                $profile->update(['subscription_type' => 'free']);
            }
        }

        $freeProfiles = Profile::where('subscription_type', 'free')->get();
        foreach ($freeProfiles as $profile) {
            $lastPayment = $this->getLatestPaidPayment($profile->user_id);
            $isGracePeriodOver = true;

            if ($lastPayment) {
                $expiresAt = Carbon::parse($lastPayment->expires_at);
                if ($expiresAt->copy()->addDays($gracePeriodDays)->isFuture()) {
                    $isGracePeriodOver = false;
                }
            }

            if ($isGracePeriodOver) {
                $this->deactivateExcessFreeListings($profile);
            }
        }
    }

    protected function getLatestPaidPayment(int $userId): ?object
    {
        return DB::table('payments')
            ->where('user_id', $userId)
            ->where('status', 'paid')
            ->orderByDesc('expires_at')
            ->first();
    }
}
