<?php

namespace App\Services;

use App\Models\Listing;
use App\Models\Payment;
use App\Models\Profile;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

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

    /**
     * Promo « Pro offert pour les free » : pilotée depuis l'admin (cache),
     * avec repli sur la variable d'environnement si aucun réglage admin.
     */
    public function isPromoProFree(): bool
    {
        $override = \Illuminate\Support\Facades\Cache::get(self::PROMO_CACHE_KEY);

        if ($override !== null) {
            return (bool) $override;
        }

        return filter_var(env('PROMO_PRO_FREE', false), FILTER_VALIDATE_BOOLEAN);
    }

    /**
     * Active/désactive la promo Pro gratuit (admin).
     */
    public function setPromoProFree(bool $active): void
    {
        \Illuminate\Support\Facades\Cache::forever(self::PROMO_CACHE_KEY, $active);
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
        return (int) env('PRO_NOTIFICATION_DELAY_HOURS', 3);
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
        return (int) env('MAX_FREE_LISTINGS', 25);
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
        return (float) env('PRO_PRICE', 30);
    }

    public function getPremiumPrice(): float
    {
        return (float) env('PREMIUM_PRICE', 50);
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
     * Traitement des expirations : rétrogradation des comptes dont le
     * paiement est expiré, puis purge des annonces excédentaires après
     * le délai de grâce. (Anciennement dans ProcessExpiredSubscriptions.)
     */
    public function processExpirations(): void
    {
        $gracePeriodDays = (int) env('SUBSCRIPTION_GRACE_PERIOD_DAYS', 15);

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
