<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Profile;
use App\Models\ReferralReward;
use App\Models\ReferralRewardGrant;
use App\Services\Referral\ReferralRewardService;
use App\Services\Referral\ReferralSettings;
use App\Services\Referral\ReferralTrackingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Parrainage côté utilisateur :
 * - POST /referral/track : appelé par le front au chargement de la landing
 *   avec ?ref=CODE — pose le cookie d'attribution et compte la visite.
 * - GET  /referral/me    : lien, compteurs, paliers avec progression, grants.
 * - GET  /referral/summary : infos publiques (page marketing), sans auth.
 */
class ReferralController extends Controller
{
    public function __construct(
        private readonly ReferralTrackingService $tracking,
        private readonly ReferralRewardService $rewards,
        private readonly ReferralSettings $settings,
    ) {}

    /**
     * Visite entrante via un lien de parrainage. Public (le visiteur n'est
     * pas forcément inscrit), throttlé au niveau route.
     */
    public function track(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|string|max:12',
            'path' => 'nullable|string|max:250',
        ]);

        $code = strtoupper(trim($validated['code']));

        // Le parrain qui teste son propre lien : visite jamais comptée, mais
        // on mémorise sa machine (fingerprint) pour bloquer l'auto-parrainage.
        $selfProfile = Profile::where('referral_code', $code)->first();
        if ($selfProfile && $request->user()?->id === $selfProfile->user_id) {
            $this->tracking->rememberSelfFingerprint($selfProfile->user, $request);

            return response()->json(['status' => 'self']);
        }

        $referrer = $this->tracking->resolveReferrer($code, $request->user());

        if (! $referrer) {
            return response()->json(['status' => 'ignored']);
        }

        $result = $this->tracking->trackVisit($referrer, $request);

        $response = response()->json([
            'status' => 'ok',
            'counted' => $result['counted'],
        ]);

        // Cookie d'attribution, même si la visite n'est pas comptée
        // (dédoublonnage) : l'inscription ultérieure doit rester attribuée.
        return $response->cookie(
            ReferralTrackingService::COOKIE_NAME,
            $code,
            $this->settings->cookieDays() * 24 * 60,
            '/', null, true, true, false, 'lax'
        );
    }

    /**
     * Infos publiques du programme (page marketing / bandeau) : paliers actifs.
     */
    public function summary(): JsonResponse
    {
        return response()->json([
            'enabled' => $this->settings->isEnabled(),
            'filleul_bonus_days' => $this->settings->filleulBonusDays(),
            'rewards' => ReferralReward::active()->get()->map(fn (ReferralReward $reward) => [
                'id' => $reward->id,
                'name' => $reward->name,
                'description' => $reward->description,
                'condition_label' => $reward->conditionLabel(),
                'reward_label' => $reward->rewardLabel(),
            ]),
        ]);
    }

    /**
     * Espace parrainage de l'utilisateur connecté : lien, compteurs
     * (shares/inscriptions), paliers avec progression %, récompenses.
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json($this->rewards->overview($request->user()));
    }

    /**
     * Historique détaillé des récompenses de l'utilisateur.
     */
    public function grants(Request $request): JsonResponse
    {
        $grants = $request->user()->referralRewardGrants()
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
                'delivery' => $grant->delivery,
            ]);

        return response()->json(['grants' => $grants]);
    }

    /**
     * Récompense à livraison physique (livre, cadeau) : le parrain saisit son
     * adresse ; l'admin est notifié et marque l'expédition dans le registre.
     */
    public function claim(Request $request, ReferralRewardGrant $grant): JsonResponse
    {
        abort_unless($grant->user_id === $request->user()->id, 403);
        abort_unless(in_array($grant->status, [ReferralRewardGrant::STATUS_GRANTED, ReferralRewardGrant::STATUS_DELIVERED], true), 422, 'Récompense non disponible.');

        $validated = $request->validate([
            'full_name' => 'required|string|max:120',
            'phone' => 'required|string|max:30',
            'address' => 'required|string|max:500',
            'city' => 'required|string|max:120',
        ]);

        $delivery = $grant->delivery ?? [];
        $delivery['address'] = $validated;
        $grant->update(['delivery' => $delivery]);

        $this->tracking->notifyAdmin(
            "📦 Parrainage : {$request->user()->name} attend la livraison de « {$grant->reward?->name} » "
            .'(grant #'.$grant->id.'). Adresse enregistrée dans le registre admin.'
        );

        return response()->json(['message' => 'Adresse enregistrée. Votre récompense sera expédiée.']);
    }

    /**
     * Téléchargement d'un ebook gagné (3 téléchargements max, chemin de
     * fichier jamais exposé au client).
     */
    public function download(Request $request, ReferralRewardGrant $grant)
    {
        abort_unless($grant->user_id === $request->user()->id, 403);

        $reward = $grant->reward;
        abort_unless($reward && in_array($reward->reward_type, ['ebook', 'premium_ebook'], true), 404);
        abort_if($grant->status === ReferralRewardGrant::STATUS_CANCELLED, 403, 'Récompense annulée.');

        $delivery = $grant->delivery ?? [];
        $path = $delivery['file_path'] ?? null;
        $downloads = (int) ($delivery['download_count'] ?? 0);

        abort_if($downloads >= 3, 403, 'Limite de téléchargements atteinte. Contactez le support.');

        $disk = Storage::disk('local');
        abort_unless($path && $disk->exists($path), 404, 'Fichier indisponible. Contactez le support.');

        $delivery['download_count'] = $downloads + 1;
        $grant->update([
            'delivery' => $delivery,
            'status' => ReferralRewardGrant::STATUS_DELIVERED,
            'delivered_at' => $grant->delivered_at ?? now(),
        ]);

        return $disk->download($path, ($reward->reward_payload['title'] ?? 'ebook').'.pdf');
    }
}
