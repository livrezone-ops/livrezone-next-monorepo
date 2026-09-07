<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Profile;
use App\Models\ReferralBlacklist;
use App\Models\ReferralReward;
use App\Models\ReferralRewardGrant;
use App\Models\ReferralSignup;
use App\Models\ReferralVisit;
use App\Models\User;
use App\Services\Referral\ReferralRewardService;
use App\Services\Referral\ReferralSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Administration du parrainage (menu Marketing → Parrainage).
 * Convention WAF OpenPanel : POST partout — même pour update/delete
 * (cf. commentaires dans routes/api.php).
 */
class AdminReferralController extends Controller
{
    public function __construct(
        private readonly ReferralSettings $settings,
        private readonly ReferralRewardService $rewards,
    ) {}

    /*
     * --------------------------- Paramètres ---------------------------
     */

    public function settings(): JsonResponse
    {
        return response()->json(['settings' => $this->settings->all()]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'referral_enabled' => 'nullable|boolean',
            'referral_filleul_bonus_days' => 'nullable|integer|min:0|max:365',
            'referral_cookie_days' => 'nullable|integer|min:1|max:90',
            'referral_min_account_age_hours' => 'nullable|integer|min:0|max:720',
            'referral_max_visits_per_day' => 'nullable|integer|min:0|max:100000',
            'referral_max_signups_per_day' => 'nullable|integer|min:0|max:10000',
            'referral_max_rewards_per_month' => 'nullable|integer|min:0|max:1000',
            'referral_notify_admin' => 'nullable|boolean',
        ]);

        foreach (array_filter($validated, fn ($v) => $v !== null) as $key => $value) {
            $this->settings->set($key, $value);
        }

        return response()->json(['settings' => $this->settings->all()]);
    }

    /*
     * --------------------------- Paliers (offres) ---------------------------
     */

    public function rewards(): JsonResponse
    {
        return response()->json([
            'rewards' => ReferralReward::orderBy('sort_order')->orderBy('threshold_value')->get()
                ->map(fn (ReferralReward $reward) => $this->serializeReward($reward)),
        ]);
    }

    public function storeReward(Request $request): JsonResponse
    {
        $validated = $this->validateReward($request);

        $reward = ReferralReward::create($validated);

        return response()->json(['reward' => $this->serializeReward($reward)], 201);
    }

    public function updateReward(Request $request, ReferralReward $reward): JsonResponse
    {
        $validated = $this->validateReward($request);

        $reward->update($validated);

        return response()->json(['reward' => $this->serializeReward($reward->fresh())]);
    }

    public function toggleReward(ReferralReward $reward): JsonResponse
    {
        $reward->update(['is_active' => ! $reward->is_active]);

        return response()->json(['reward' => $this->serializeReward($reward->fresh())]);
    }

    public function destroyReward(ReferralReward $reward): JsonResponse
    {
        // Les grants émis restent dans le ledger (historique financier du
        // programme) — on refuse la suppression si la palier a déjà été
        // attribué : désactiver plutôt.
        if ($reward->grants()->exists()) {
            return response()->json([
                'message' => 'Ce palier a déjà été attribué : désactivez-le au lieu de le supprimer.',
            ], 422);
        }

        $reward->delete();

        return response()->json(['message' => 'Palier supprimé.']);
    }

    private function validateReward(Request $request): array
    {
        return $request->validate([
            'name' => 'required|string|max:100',
            'description' => 'nullable|string|max:1000',
            'condition_type' => ['required', Rule::in(ReferralReward::CONDITION_TYPES)],
            'reward_type' => ['required', Rule::in(ReferralReward::REWARD_TYPES)],
            'reward_payload' => 'required|array',
            'reward_payload.days' => 'required_if:reward_type,pro_days|integer|min:1|max:365',
            'reward_payload.percent' => 'required_if:reward_type,percent_discount|numeric|min:1|max:100',
            'reward_payload.scope' => 'nullable|in:monthly,yearly',
            'reward_payload.amount' => 'required_if:reward_type,coupon|numeric|min:0.01|max:100000',
            'reward_payload.title' => 'nullable|string|max:200',
            'reward_payload.file_path' => 'nullable|string|max:500',
            'threshold_value' => 'required|integer|min:1|max:100000',
            'repeatable' => 'nullable|boolean',
            'max_grants_per_user' => 'nullable|integer|min:1',
            'unit_cost' => 'nullable|numeric|min:0|max:100000',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0',
        ]);
    }

    private function serializeReward(ReferralReward $reward): array
    {
        return array_merge($reward->toArray(), [
            'reward_label' => $reward->rewardLabel(),
            'condition_label' => $reward->conditionLabel(),
            'grants_count' => $reward->grants()
                ->where('status', '!=', ReferralRewardGrant::STATUS_CANCELLED)->count(),
        ]);
    }

    /*
     * --------------------------- Statistiques ---------------------------
     */

    public function stats(): JsonResponse
    {
        return response()->json($this->rewards->adminStats());
    }

    /**
     * Classement des parrains par compteurs (les deux colonnes sont indexées
     * sur profiles) : sort=referral_signups_count|referral_shares_count.
     */
    public function users(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'sort' => ['nullable', Rule::in(['referral_signups_count', 'referral_shares_count'])],
            'dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'min' => 'nullable|integer|min:0',
            'search' => 'nullable|string|max:100',
            'per_page' => 'nullable|integer|min:5|max:100',
        ]);

        $sort = $validated['sort'] ?? 'referral_signups_count';
        $dir = $validated['dir'] ?? 'desc';

        $query = Profile::query()
            ->with('user:id,name,email')
            ->where(function ($q) {
                $q->where('referral_shares_count', '>', 0)
                    ->orWhere('referral_signups_count', '>', 0);
            })
            ->orderBy($sort, $dir)
            ->orderByDesc('referral_signups_count');

        if (isset($validated['min'])) {
            $query->where($sort, '>=', $validated['min']);
        }

        if (! empty($validated['search'])) {
            $search = $validated['search'];
            $query->whereHas('user', fn ($q) => $q->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%"));
        }

        $paginator = $query->paginate($validated['per_page'] ?? 25, [
            'id', 'user_id', 'nickname', 'referral_code', 'referral_shares_count',
            'referral_signups_count', 'referral_blocked_at',
        ]);

        $paginator->getCollection()->transform(fn (Profile $profile) => [
            'id' => $profile->id,
            'user_id' => $profile->user_id,
            'name' => $profile->user?->name,
            'email' => $profile->user?->email,
            'nickname' => $profile->nickname,
            'referral_code' => $profile->referral_code,
            'referral_shares_count' => (int) $profile->referral_shares_count,
            'referral_signups_count' => (int) $profile->referral_signups_count,
            'referral_blocked_at' => $profile->referral_blocked_at?->toIso8601String(),
        ]);

        return response()->json(['users' => $paginator]);
    }

    /*
     * --------------------------- Registre & anti-abus ---------------------------
     */

    public function grants(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', Rule::in(['granted', 'delivered', 'cancelled'])],
            'user_id' => 'nullable|integer',
            'per_page' => 'nullable|integer|min:5|max:100',
        ]);

        $query = ReferralRewardGrant::with(['reward', 'user:id,name,email'])
            ->orderByDesc('granted_at');

        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }
        if (! empty($validated['user_id'])) {
            $query->where('user_id', $validated['user_id']);
        }

        return response()->json(['grants' => $query->paginate($validated['per_page'] ?? 25)]);
    }

    /**
     * Marque une récompense comme livrée (livre physique expédié, cadeau remis).
     */
    public function deliverGrant(Request $request, ReferralRewardGrant $grant): JsonResponse
    {
        abort_if($grant->status === ReferralRewardGrant::STATUS_CANCELLED, 422, 'Récompense annulée.');

        $grant->update([
            'status' => ReferralRewardGrant::STATUS_DELIVERED,
            'delivered_at' => now(),
        ]);

        return response()->json(['grant' => $grant->fresh()]);
    }

    /**
     * Annule une récompense (fraude avérée). Le Pro/coupon déjà consommé ne
     * peut être repris automatiquement : ajuster l'abonnement via les outils
     * admin existants si nécessaire.
     */
    public function cancelGrant(Request $request, ReferralRewardGrant $grant): JsonResponse
    {
        $validated = $request->validate(['reason' => 'nullable|string|max:500']);

        $grant->update([
            'status' => ReferralRewardGrant::STATUS_CANCELLED,
            'delivery' => array_merge($grant->delivery ?? [], ['cancel_reason' => $validated['reason'] ?? null]),
        ]);

        return response()->json(['grant' => $grant->fresh()]);
    }

    /**
     * Relance l'évaluation des paliers d'un parrain (après revue d'un cap
     * anti-abus atteint, ou correction manuelle).
     */
    public function evaluateUser(User $user): JsonResponse
    {
        $granted = $this->rewards->evaluate($user);

        return response()->json([
            'message' => count($granted).' récompense(s) accordée(s).',
            'granted' => collect($granted)->map(fn ($g) => [
                'id' => $g->id,
                'reward' => $g->reward?->name,
            ]),
        ]);
    }

    /**
     * Gèle/dégèle un utilisateur dans le programme (fraude confirmée).
     */
    public function toggleUserBlock(User $user): JsonResponse
    {
        abort_unless($user->profile, 404, 'Profil introuvable.');

        $user->profile->forceFill([
            'referral_blocked_at' => $user->profile->isReferralBlocked() ? null : now(),
        ])->save();

        return response()->json([
            'referral_blocked_at' => $user->profile->fresh()->referral_blocked_at?->toIso8601String(),
        ]);
    }

    public function blacklists(): JsonResponse
    {
        return response()->json([
            'blacklists' => ReferralBlacklist::orderBy('type')->orderBy('value')->get(),
        ]);
    }

    public function storeBlacklist(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['required', Rule::in(ReferralBlacklist::TYPES)],
            'value' => 'required|string|max:191',
            'reason' => 'nullable|string|max:500',
        ]);

        // IP et domaines normalisés en minuscules pour une comparaison fiable.
        $validated['value'] = strtolower(trim($validated['value']));

        $blacklist = ReferralBlacklist::firstOrCreate(
            ['type' => $validated['type'], 'value' => $validated['value']],
            ['reason' => $validated['reason'] ?? null]
        );

        return response()->json(['blacklist' => $blacklist], 201);
    }

    public function destroyBlacklist(ReferralBlacklist $blacklist): JsonResponse
    {
        $blacklist->delete();

        return response()->json(['message' => 'Entrée retirée de la blacklist.']);
    }

    /**
     * Détail des visites (anti-fraude : fingerprints répétés, IP partagées).
     */
    public function visits(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'referrer_user_id' => 'nullable|integer',
            'counted' => 'nullable|boolean',
            'per_page' => 'nullable|integer|min:5|max:100',
        ]);

        $query = ReferralVisit::with('referrer:id,name,email')
            ->orderByDesc('created_at');

        if (! empty($validated['referrer_user_id'])) {
            $query->where('referrer_user_id', $validated['referrer_user_id']);
        }
        if (array_key_exists('counted', $validated) && $validated['counted'] !== null) {
            $query->where('counted', (bool) $validated['counted']);
        }

        return response()->json(['visits' => $query->paginate($validated['per_page'] ?? 50)]);
    }

    /**
     * Détail des attributions filleul (audit parrain).
     */
    public function signups(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'referrer_user_id' => 'nullable|integer',
            'status' => ['nullable', Rule::in(['pending', 'valid', 'invalid'])],
            'per_page' => 'nullable|integer|min:5|max:100',
        ]);

        $query = ReferralSignup::with(['referrer:id,name,email', 'filleul:id,name,email'])
            ->orderByDesc('created_at');

        if (! empty($validated['referrer_user_id'])) {
            $query->where('referrer_user_id', $validated['referrer_user_id']);
        }
        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        return response()->json(['signups' => $query->paginate($validated['per_page'] ?? 50)]);
    }
}
