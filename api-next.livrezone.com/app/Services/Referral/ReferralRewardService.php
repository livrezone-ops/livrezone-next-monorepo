<?php

namespace App\Services\Referral;

use App\Jobs\EvaluateReferralRewards;
use App\Models\DiscountCode;
use App\Models\Payment;
use App\Models\Profile;
use App\Models\ReferralReward;
use App\Models\ReferralRewardGrant;
use App\Models\ReferralSignup;
use App\Models\ReferralVisit;
use App\Models\User;
use App\Notifications\ReferralRewardUnlocked;
use App\Services\SubscriptionService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Évaluation des paliers et livraison des récompenses.
 *
 * Déclencheur unique : la validation de l'email filleul (AuthController::verifyEmail)
 * — ou l'inscription via provider social, traitée comme validée d'office.
 * Toute attribution passe par evaluate() : transaction + lockForUpdate sur le
 * parrain → un palier ne peut jamais être crédité deux fois, même avec des
 * jobs concurrents ou rejoués.
 */
class ReferralRewardService
{
    public function __construct(
        private readonly ReferralSettings $settings,
        private readonly ReferralTrackingService $tracking,
    ) {}

    /**
     * Une inscription filleul vient d'être validée (email vérifié). Passe le
     * signup en « valid », incrémente le compteur du parrain, puis déclenche
     * l'évaluation des paliers (job en file, différé si âge minimum requis).
     */
    public function onSignupValidated(User $filleul): void
    {
        $signup = ReferralSignup::where('filleul_user_id', $filleul->id)
            ->where('status', ReferralSignup::STATUS_PENDING)
            ->first();

        if (! $signup) {
            return;
        }

        $signup->update(['status' => ReferralSignup::STATUS_VALID, 'valid_at' => now()]);

        $referrer = User::with('profile')->find($signup->referrer_user_id);
        if (! $referrer || ! $referrer->profile || $referrer->profile->isReferralBlocked()) {
            return;
        }

        $referrer->profile->increment('referral_signups_count');

        // Cap anti-abus : au-delà du plafond journalier, l'inscription est
        // comptée mais l'évaluation des paliers est gelée jusqu'à revue admin
        // (relançable via POST /admin/referral/users/{user}/evaluate).
        $maxPerDay = $this->settings->maxSignupsPerDay();
        if ($maxPerDay > 0) {
            $todayValid = ReferralSignup::where('referrer_user_id', $referrer->id)
                ->where('status', ReferralSignup::STATUS_VALID)
                ->where('valid_at', '>=', now()->startOfDay())
                ->count();

            if ($todayValid > $maxPerDay) {
                $this->tracking->notifyAdminOncePerDay(
                    'referral.cap.signups.'.$referrer->id,
                    "🚧 Parrainage : {$referrer->name} (user #{$referrer->id}) a dépassé {$maxPerDay} inscriptions "
                    .'validées aujourd\'hui. Évaluation des paliers gelée pour le surplus — à relancer après revue.'
                );

                return;
            }
        }

        // Bonus de bienvenue du filleul (double sens), une seule fois.
        $bonusDays = $this->settings->filleulBonusDays();
        if ($bonusDays > 0) {
            $this->grantProDays($filleul, $bonusDays, "referral-bonus-{$filleul->id}");
        }

        // L'âge minimum du compte est porté par le délai du job : à l'exécution,
        // le compte a mécaniquement l'âge requis (et l'email déjà vérifié).
        $minAgeHours = $this->settings->minAccountAgeHours();
        $delay = $minAgeHours > 0
            ? now()->diffInSeconds($filleul->created_at->copy()->addHours($minAgeHours), false)
            : 0;
        $delaySeconds = max(0, (int) $delay);

        EvaluateReferralRewards::dispatch($referrer->id)
            ->delay($delaySeconds > 0 ? now()->addSeconds($delaySeconds) : null);
    }

    /**
     * Évalue tous les paliers actifs pour un parrain et crédite ceux atteints.
     * Idempotent : rejouable sans double crédit.
     */
    public function evaluate(User $parrain): array
    {
        $profile = $parrain->profile;
        if (! $this->settings->isEnabled() || ! $profile || $profile->isReferralBlocked()) {
            return [];
        }

        $granted = [];

        DB::transaction(function () use ($parrain, $profile, &$granted) {
            // Verrou du parrain (sa ligne profiles) : deux évaluations
            // concurrentes se sérialisent ici.
            $locked = Profile::where('id', $profile->id)->lockForUpdate()->first();
            $profile->setRawAttributes($locked->getAttributes());

            // Cap mensuel de récompenses (les paliers à 1 inscription sont
            // exemptés pour ne jamais bloquer l'activation du programme). Le
            // cap est appliqué aussi PENDANT une évaluation qui débloquerait
            // plusieurs paliers d'un coup.
            $maxPerMonth = $this->settings->maxRewardsPerMonth();
            $monthlyCount = 0;
            if ($maxPerMonth > 0) {
                $monthlyCount = ReferralRewardGrant::where('user_id', $parrain->id)
                    ->where('granted_at', '>=', now()->startOfMonth())
                    ->whereHas('reward', fn ($q) => $q->where('threshold_value', '>', 1))
                    ->count();
            }

            $existingRewardIds = ReferralRewardGrant::where('user_id', $parrain->id)
                ->where('status', '!=', ReferralRewardGrant::STATUS_CANCELLED)
                ->pluck('reward_id')
                ->countBy();

            foreach (ReferralReward::active()->get() as $reward) {
                $current = $reward->condition_type === 'visits'
                    ? (int) $profile->referral_shares_count
                    : (int) $profile->referral_signups_count;

                if ($reward->threshold_value <= 0 || $current < $reward->threshold_value) {
                    continue;
                }

                if ($maxPerMonth > 0 && $reward->threshold_value > 1
                    && $monthlyCount >= $maxPerMonth) {
                    $this->tracking->notifyAdminOncePerDay(
                        'referral.cap.rewards.'.$parrain->id,
                        "🚧 Parrainage : {$parrain->name} (user #{$parrain->id}) a atteint la limite de "
                        ."{$maxPerMonth} récompenses ce mois-ci. Paliers suivants mis en attente."
                    );

                    break;
                }

                $already = $existingRewardIds[$reward->id] ?? 0;

                if ($reward->repeatable) {
                    // Accordé à chaque multiple du seuil atteint.
                    $expected = intdiv($current, $reward->threshold_value);
                    if ($already >= $expected) {
                        continue;
                    }
                } elseif ($already > 0) {
                    continue;
                }

                if ($reward->max_grants_per_user !== null && $already >= $reward->max_grants_per_user) {
                    continue;
                }

                $grant = $this->grantReward($reward, $parrain);
                if ($grant !== null) {
                    $granted[] = $grant;
                    if ($reward->threshold_value > 1) {
                        $monthlyCount++;
                    }
                }
            }
        });

        return $granted;
    }

    /**
     * Crédite un palier : ledger + livraison selon le type + notifications.
     */
    public function grantReward(ReferralReward $reward, User $parrain, ?ReferralSignup $signup = null): ?ReferralRewardGrant
    {
        $grant = ReferralRewardGrant::create([
            'reward_id' => $reward->id,
            'user_id' => $parrain->id,
            'signup_id' => $signup?->id,
            'status' => ReferralRewardGrant::STATUS_GRANTED,
            'granted_at' => now(),
        ]);

        $delivery = $this->deliver($reward, $parrain, $grant);
        $grant->update(['delivery' => $delivery]);

        // Notification in-app du parrain.
        $parrain->notify(new ReferralRewardUnlocked($reward, $grant));

        // Notification Telegram admin : « tel user a atteint tel palier ».
        $this->tracking->notifyAdmin(
            "🎁 Parrainage : {$parrain->name} (user #{$parrain->id}) a atteint le palier « {$reward->name} » "
            ."({$reward->conditionLabel()}) → {$reward->rewardLabel()}."
        );

        return $grant->fresh();
    }

    /**
     * Livraison immédiate selon le type. Retourne le contenu de grant.delivery.
     */
    private function deliver(ReferralReward $reward, User $user, ReferralRewardGrant $grant): array
    {
        $payload = $reward->reward_payload ?? [];

        return match ($reward->reward_type) {
            'pro_days' => $this->deliverProDays($reward, $user, $grant, (int) ($payload['days'] ?? 0)),
            'percent_discount' => $this->deliverCoupon(
                $user, $grant, 'percent', (float) ($payload['percent'] ?? 0)
            ),
            'coupon' => $this->deliverCoupon($user, $grant, 'fixed', (float) ($payload['amount'] ?? 0)),
            'ebook', 'premium_ebook' => [
                'title' => $payload['title'] ?? $reward->name,
                'file_path' => $payload['file_path'] ?? null,
                'download_count' => 0,
            ],
            // Livraison manuelle : adresse collectée via le claim, expédition
            // marquée par l'admin depuis le registre.
            'physical_book', 'gift' => ['title' => $payload['title'] ?? $reward->name],
            default => [],
        };
    }

    /**
     * Crédite des jours de Pro (récompense parrain ou bonus filleul) via une
     * ligne payments amount 0 method « referral » — intégrée au moteur
     * d'expiration existant (processExpirations). Un compte premium n'est pas
     * déclassé : conversion en coupon de valeur équivalente.
     */
    public function grantProDays(User $user, int $days, string $transactionId): array
    {
        if ($days <= 0) {
            return ['days' => 0];
        }

        $lastPayment = DB::table('payments')
            ->where('user_id', $user->id)
            ->where('status', 'paid')
            ->orderByDesc('expires_at')
            ->first();

        $base = ($lastPayment && $lastPayment->expires_at && Carbon::parse($lastPayment->expires_at)->isFuture())
            ? Carbon::parse($lastPayment->expires_at)
            : now();
        $expiresAt = $base->copy()->addDays($days);

        $profile = Profile::where('user_id', $user->id)->first();
        if (! $profile) {
            // Compte ancien sans profil : même convention que ensureProfileExists
            // (ville « Autre » auto-créée) pour ne jamais perdre une récompense.
            $cityId = DB::table('cities')->where('name', 'Autre')->value('id')
                ?? DB::table('cities')->insertGetId([
                    'name' => 'Autre',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            $profile = Profile::create([
                'user_id' => $user->id,
                'city_id' => $cityId,
                'nickname' => 'user-'.$user->id,
            ]);
        }
        $isPremium = $profile->subscription_type === 'premium';

        if ($isPremium) {
            // Pas de déclassement premium → Pro : équivalent en coupon
            // (jours × prix journalier du Pro, via SubscriptionService).
            $proPrice = (float) app(SubscriptionService::class)->getProPrice();
            $equivalent = round($days * ($proPrice / 30), 2);

            if ($equivalent < 0.01) {
                return ['days' => $days, 'converted' => false, 'error' => 'pro_price non configuré'];
            }

            $coupon = $this->createCoupon($user, 'fixed', $equivalent, 'PARRAIN-'.Str::upper(Str::random(5)));

            return [
                'days' => $days,
                'converted_to_coupon' => true,
                'code' => $coupon->code,
                'discount_code_id' => $coupon->id,
            ];
        }

        $already = DB::table('payments')->where('transaction_id', $transactionId)->exists();
        if (! $already) {
            Payment::create([
                'user_id' => $user->id,
                'amount' => 0,
                'payment_method' => 'referral',
                'transaction_id' => $transactionId,
                'subscription_type' => 'pro',
                'status' => 'paid',
                'paid_at' => now(),
                'expires_at' => $expiresAt,
            ]);

            $profile->update(['subscription_type' => 'pro']);
        }

        return ['days' => $days, 'expires_at' => $expiresAt->toIso8601String()];
    }

    private function deliverProDays(ReferralReward $reward, User $user, ReferralRewardGrant $grant, int $days): array
    {
        if ($days <= 0) {
            return ['days' => 0, 'error' => 'payload.days manquant'];
        }

        return $this->grantProDays($user, $days, "referral-grant-{$grant->id}");
    }

    /**
     * Génère un DiscountCode unique lié au parrain — consommé tel quel par le
     * checkout existant (types 'percent' / 'fixed').
     */
    private function deliverCoupon(User $user, ReferralRewardGrant $grant, string $type, float $value): array
    {
        if ($value <= 0) {
            return ['error' => 'payload invalide'];
        }

        $discountCode = $this->createCoupon($user, $type, $value, "PARRAIN-{$grant->id}-".Str::upper(Str::random(4)));

        return [
            'code' => $discountCode->code,
            'discount_code_id' => $discountCode->id,
            'expires_at' => $discountCode->expires_at?->toIso8601String(),
        ];
    }

    private function createCoupon(User $user, string $type, float $value, string $codePrefix): DiscountCode
    {
        // Idempotence : si un code a déjà été généré pour ce préfixe (rejeu), on le retrouve.
        $existing = DiscountCode::where('code', 'like', $codePrefix.'%')->first();
        if ($existing) {
            return $existing;
        }

        return DiscountCode::create([
            'code' => Str::limit($codePrefix, 28, ''),
            'type' => $type,
            'value' => $value,
            'is_active' => true,
            'expires_at' => now()->addDays(30),
            'max_uses' => 1,
            'times_used' => 0,
        ]);
    }

    /*
     * ------------------- Lecture (espace utilisateur / admin) -------------------
     */

    /**
     * Vue complète pour GET /referral/me : lien, compteurs, paliers avec
     * progression, récompenses obtenues.
     */
    public function overview(User $user): array
    {
        $profile = $user->profile;
        if (! $profile) {
            $profile = $user->profile()->create([
                'city_id' => DB::table('cities')->where('name', 'Autre')->value('id') ?? 1,
                'nickname' => 'user-'.$user->id,
            ]);
        }

        $signups = (int) $profile->referral_signups_count;
        $visits = (int) $profile->referral_shares_count;

        $rewards = ReferralReward::active()->get()->map(function (ReferralReward $reward) use ($signups, $visits) {
            $current = $reward->condition_type === 'visits' ? $visits : $signups;
            $target = max(1, $reward->threshold_value);
            $percent = (int) min(100, floor($current / $target * 100));

            return [
                'id' => $reward->id,
                'name' => $reward->name,
                'description' => $reward->description,
                'condition_label' => $reward->conditionLabel(),
                'condition_type' => $reward->condition_type,
                'threshold_value' => $reward->threshold_value,
                'reward_type' => $reward->reward_type,
                'reward_label' => $reward->rewardLabel(),
                'repeatable' => $reward->repeatable,
                'progress' => [
                    'current' => min($current, $target),
                    'target' => $target,
                    'percent' => $percent,
                    'remaining' => max(0, $reward->threshold_value - $current),
                ],
                'unlocked' => $current >= $reward->threshold_value,
            ];
        })->values();

        $grants = $profile->referralRewardGrants()
            ->with('reward')
            ->orderByDesc('granted_at')
            ->get()
            ->map(fn (ReferralRewardGrant $grant) => [
                'id' => $grant->id,
                'reward_name' => $grant->reward?->name,
                'reward_label' => $grant->reward?->rewardLabel(),
                'reward_type' => $grant->reward?->reward_type,
                'status' => $grant->status,
                'granted_at' => $grant->granted_at?->toIso8601String(),
                'delivered_at' => $grant->delivered_at?->toIso8601String(),
                'delivery' => $this->publicDelivery($grant),
            ]);

        return [
            'referral_code' => $profile->referralCode(),
            'referral_link' => $profile->referralLink(),
            'enabled' => $this->settings->isEnabled(),
            'stats' => [
                'shares' => $visits,
                'signups' => $signups,
                'rewards_count' => $profile->referralRewardGrants()
                    ->where('status', '!=', ReferralRewardGrant::STATUS_CANCELLED)->count(),
            ],
            'rewards' => $rewards,
            'grants' => $grants,
        ];
    }

    private function publicDelivery(ReferralRewardGrant $grant): ?array
    {
        $delivery = $grant->delivery;
        if (! is_array($delivery)) {
            return null;
        }

        // Le chemin du fichier ebook n'est jamais exposé au client.
        unset($delivery['file_path']);

        return $delivery;
    }

    /**
     * Statistiques admin (dashboard parrainage).
     */
    public function adminStats(): array
    {
        $visits = ReferralVisit::where('counted', true)->count();
        $signups = ReferralSignup::count();
        $validSignups = ReferralSignup::where('status', ReferralSignup::STATUS_VALID)->count();

        $grantsByType = ReferralRewardGrant::where('status', '!=', ReferralRewardGrant::STATUS_CANCELLED)
            ->join('referral_rewards', 'referral_rewards.id', '=', 'referral_reward_grants.reward_id')
            ->groupBy('referral_rewards.reward_type', 'referral_rewards.name')
            ->selectRaw('referral_rewards.reward_type, referral_rewards.name, COUNT(*) as total, SUM(referral_rewards.unit_cost) as cost')
            ->get();

        $topReferrers = Profile::with('user:id,name,email')
            ->where('referral_signups_count', '>', 0)
            ->orderByDesc('referral_signups_count')
            ->orderByDesc('referral_shares_count')
            ->limit(10)
            ->get(['id', 'user_id', 'referral_shares_count', 'referral_signups_count'])
            ->map(fn (Profile $profile) => [
                'user_id' => $profile->user_id,
                'name' => $profile->user?->name,
                'email' => $profile->user?->email,
                'referral_shares_count' => (int) $profile->referral_shares_count,
                'referral_signups_count' => (int) $profile->referral_signups_count,
            ]);

        return [
            'parrains' => ReferralSignup::distinct('referrer_user_id')->count('referrer_user_id'),
            'filleuls' => $signups,
            'visits' => $visits,
            'signups_valid' => $validSignups,
            'conversion_rate' => $visits > 0 ? round($validSignups / $visits * 100, 2) : null,
            'rewards_distributed' => [
                'total' => $grantsByType->sum('total'),
                'by_type' => $grantsByType->map(fn ($row) => [
                    'reward_type' => $row->reward_type,
                    'name' => $row->name,
                    'total' => (int) $row->total,
                    'cost' => (float) $row->cost,
                ]),
                'estimated_cost' => round((float) $grantsByType->sum('cost'), 2),
            ],
            'top_referrers' => $topReferrers,
            'series_30d' => $this->series30d(),
        ];
    }

    /**
     * Séries quotidiennes (visites comptées / inscriptions validées) sur 30 jours.
     */
    private function series30d(): array
    {
        $from = now()->subDays(29)->startOfDay();

        $visits = ReferralVisit::where('counted', true)
            ->where('created_at', '>=', $from)
            ->selectRaw('DATE(created_at) as day, COUNT(*) as total')
            ->groupBy('day')->pluck('total', 'day');

        $signups = ReferralSignup::where('status', ReferralSignup::STATUS_VALID)
            ->where('valid_at', '>=', $from)
            ->selectRaw('DATE(valid_at) as day, COUNT(*) as total')
            ->groupBy('day')->pluck('total', 'day');

        $days = [];
        for ($i = 29; $i >= 0; $i--) {
            $day = now()->subDays($i)->toDateString();
            $days[] = [
                'date' => $day,
                'visits' => (int) ($visits[$day] ?? 0),
                'signups' => (int) ($signups[$day] ?? 0),
            ];
        }

        return $days;
    }
}
