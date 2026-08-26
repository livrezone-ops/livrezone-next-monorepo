<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DiscountCode;
use App\Models\Payment;
use App\Services\AdminPaymentService;
use App\Services\SubscriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PaymentController extends Controller
{
    public function index(Request $request)
    {
        $payments = Payment::where('user_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['payments' => $payments]);
    }

    /**
     * Aperçu en temps réel du montant (utilisé pendant la saisie du coupon).
     * Ne crée rien : même calcul que store(), source de vérité unique.
     */
    public function preview(Request $request, SubscriptionService $subscriptions): JsonResponse
    {
        $validated = $request->validate([
            'subscription_type' => ['required', Rule::in(['pro', 'premium'])],
            'period' => ['required', Rule::in(['monthly', 'yearly'])],
            'discount_code' => 'nullable|string|max:30',
        ]);

        [$amount, $baseAmount, $coupon] = $this->resolveAmount(
            $validated['subscription_type'],
            $validated['period'],
            $validated['discount_code'] ?? null,
            $subscriptions
        );

        return response()->json([
            'base_amount' => $baseAmount,
            'amount' => $amount,
            'coupon_valid' => $coupon !== null,
            'discount' => $coupon ? round($baseAmount - $amount, 2) : 0,
        ]);
    }

    /**
     * Demande d'abonnement : crée un paiement en attente de validation admin.
     * Le montant est TOUJOURS calculé côté serveur depuis les réglages,
     * après application éventuelle d'un code de réduction.
     */
    public function store(Request $request, SubscriptionService $subscriptions): JsonResponse
    {
        /** @var \App\Services\PaymentGatewayService $gateways */
        $gateways = app(\App\Services\PaymentGatewayService::class);
        $onlineGateways = $gateways->enabled();

        $validated = $request->validate([
            'subscription_type' => ['required', Rule::in(['pro', 'premium'])],
            'period' => ['required', Rule::in(['monthly', 'yearly'])],
            'payment_method' => ['required', 'string', 'max:30'],
            'discount_code' => 'nullable|string|max:30',
        ]);

        // Inscriptions Pro/Premium momentanément fermées par l'admin ?
        if ($subscriptions->areSubscriptionsDisabled()) {
            throw ValidationException::withMessages([
                'subscription_type' => 'L\'inscription à Pro et Premium est désactivée momentanément.',
            ]);
        }

        // Méthodes manuelles (validation admin) ou passerelles en ligne (auto).
        $isGateway = in_array($validated['payment_method'], $onlineGateways, true);

        if (! $isGateway && ! in_array($validated['payment_method'], $subscriptions->enabledPaymentMethods(), true)) {
            throw ValidationException::withMessages([
                'payment_method' => 'Ce moyen de paiement n\'est pas disponible actuellement.',
            ]);
        }

        // Passerelle réelle sans simulateur : nécessite l'intégration concrète
        // (initiate + webhook). Pour l'instant on informe proprement.
        if ($isGateway && ! config('livrezone.payment_simulator')) {
            throw ValidationException::withMessages([
                'payment_method' => 'Le paiement en ligne via ' . ucfirst($validated['payment_method']) . ' sera bientôt disponible.',
            ]);
        }

        // Une seule demande en attente à la fois : la nouvelle REMPLACE
        // l'ancienne (demande abandonnée = aucune valeur, on ne bloque pas
        // l'utilisateur indéfiniment).
        Payment::where('user_id', $request->user()->id)
            ->where('status', 'pending')
            ->delete();

        [$amount, , $coupon] = $this->resolveAmount(
            $validated['subscription_type'],
            $validated['period'],
            $validated['discount_code'] ?? null,
            $subscriptions
        );

        $payment = Payment::create([
            'user_id' => $request->user()->id,
            'amount' => $amount,
            'payment_method' => $validated['payment_method'],
            'subscription_type' => $validated['subscription_type'],
            'period' => $validated['period'],
            'discount_code' => $coupon?->code,
            'status' => 'pending',
        ]);

        // Passerelle en ligne : en mode simulateur on confirme immédiatement
        // (activation + email), comme le ferait le webhook du prestataire.
        if ($isGateway && config('livrezone.payment_simulator')) {
            app(AdminPaymentService::class)->markPaid($payment->fresh());
        }

        // Code de paiement Fatourati : référence à communiquer lors du paiement.
        if ($validated['payment_method'] === 'fatourati') {
            $code = 'FTR-' . str_pad((string) $payment->id, 6, '0', STR_PAD_LEFT);
            $payment->update(['transaction_id' => $code]);
        }

        $payment = $payment->fresh();

        return response()->json([
            'message' => $isGateway && config('livrezone.payment_simulator')
                ? 'Paiement confirmé (mode test). Votre abonnement est actif !'
                : 'Votre demande a été enregistrée.',
            'payment' => $payment,
            'simulator' => (bool) config('livrezone.payment_simulator'),
            'flow' => $isGateway ? 'online' : 'manual',
            'fatourati_code' => $validated['payment_method'] === 'fatourati' ? $payment->transaction_id : null,
        ], 201);
    }

    /**
     * Calcule le montant final : prix des réglages, moins la remise du coupon
     * si celui-ci est valide. Retourne [montant final, montant de base, coupon|null].
     *
     * @return array{0: float, 1: float, 2: DiscountCode|null}
     */
    private function resolveAmount(string $type, string $period, ?string $code, SubscriptionService $subscriptions): array
    {
        $isPro = $type === 'pro';
        $baseAmount = $period === 'yearly'
            ? ($isPro ? $subscriptions->getProPriceYearly() : $subscriptions->getPremiumPriceYearly())
            : ($isPro ? $subscriptions->getProPrice() : $subscriptions->getPremiumPrice());

        if (! $code) {
            return [(float) $baseAmount, (float) $baseAmount, null];
        }

        $coupon = DiscountCode::where('code', strtoupper($code))->first();

        if (
            ! $coupon || ! $coupon->is_active ||
            ($coupon->expires_at && $coupon->expires_at->isPast()) ||
            ($coupon->max_uses !== null && $coupon->times_used >= $coupon->max_uses)
        ) {
            throw ValidationException::withMessages([
                'discount_code' => 'Code de réduction invalide ou expiré.',
            ]);
        }

        $amount = $coupon->type === 'percent'
            ? round($baseAmount * (1 - ($coupon->value / 100)), 2)
            : max(0, (float) $baseAmount - (float) $coupon->value);

        return [$amount, (float) $baseAmount, $coupon];
    }

    /**
     * SIMULATEUR DE PAIEMENT (tests uniquement).
     *
     * Actif uniquement si PAYMENT_SIMULATOR=true. Simule la confirmation
     * d'une passerelle (CMI, etc.) : bascule le paiement en "payé",
     * active l'abonnement et envoie l'email de confirmation.
     */
    public function simulateConfirm(
        Request $request,
        Payment $payment,
        AdminPaymentService $adminPaymentService
    ): JsonResponse {
        abort_unless((bool) config('livrezone.payment_simulator'), 403, 'Simulateur de paiement désactivé.');

        // Chacun ne peut confirmer que SES paiements, uniquement s'ils sont en attente.
        abort_if($payment->user_id !== $request->user()->id, 403);

        if ($payment->status === 'paid') {
            return response()->json(['message' => 'Ce paiement est déjà confirmé.', 'payment' => $payment]);
        }

        $updated = $adminPaymentService->markPaid($payment);

        // L'email de confirmation part depuis markPaid(), après activation.

        return response()->json([
            'message' => 'Paiement confirmé (mode test). Votre abonnement est actif !',
            'simulated' => true,
            'payment' => $updated,
        ]);
    }
}
