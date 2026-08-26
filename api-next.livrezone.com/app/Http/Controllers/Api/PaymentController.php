<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\PaymentConfirmedMail;
use App\Models\DiscountCode;
use App\Models\Payment;
use App\Services\AdminPaymentService;
use App\Services\SubscriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
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
     * Demande d'abonnement : crée un paiement en attente de validation admin.
     * Le montant est TOUJOURS calculé côté serveur depuis les réglages,
     * après application éventuelle d'un code de réduction.
     */
    public function store(Request $request, SubscriptionService $subscriptions): JsonResponse
    {
        $validated = $request->validate([
            'subscription_type' => ['required', Rule::in(['pro', 'premium'])],
            'period' => ['required', Rule::in(['monthly', 'yearly'])],
            'payment_method' => ['required', Rule::in(['virement', 'especes', 'cheque', 'autre'])],
            'discount_code' => 'nullable|string|max:30',
        ]);

        // Une seule demande en attente à la fois par utilisateur.
        $pending = Payment::where('user_id', $request->user()->id)
            ->where('status', 'pending')
            ->exists();

        if ($pending) {
            throw ValidationException::withMessages([
                'payment_method' => 'Vous avez déjà une demande en attente de validation.',
            ]);
        }

        // Code de réduction (facultatif) : doit être actif, non expiré, sous quota.
        $coupon = null;
        if (! empty($validated['discount_code'])) {
            $coupon = DiscountCode::where('code', strtoupper($validated['discount_code']))->first();

            if (
                ! $coupon || ! $coupon->is_active ||
                ($coupon->expires_at && $coupon->expires_at->isPast()) ||
                ($coupon->max_uses !== null && $coupon->times_used >= $coupon->max_uses)
            ) {
                throw ValidationException::withMessages([
                    'discount_code' => 'Code de réduction invalide ou expiré.',
                ]);
            }
        }

        $isPro = $validated['subscription_type'] === 'pro';
        $amount = $validated['period'] === 'yearly'
            ? ($isPro ? $subscriptions->getProPriceYearly() : $subscriptions->getPremiumPriceYearly())
            : ($isPro ? $subscriptions->getProPrice() : $subscriptions->getPremiumPrice());

        // Application de la remise
        if ($coupon) {
            $amount = $coupon->type === 'percent'
                ? round($amount * (1 - ($coupon->value / 100)), 2)
                : max(0, (float) $amount - (float) $coupon->value);
        }

        $payment = Payment::create([
            'user_id' => $request->user()->id,
            'amount' => $amount,
            'payment_method' => $validated['payment_method'],
            'subscription_type' => $validated['subscription_type'],
            'period' => $validated['period'],
            'discount_code' => $coupon?->code,
            'status' => 'pending',
        ]);

        return response()->json([
            'message' => config('livrezone.payment_simulator')
                ? 'Demande créée. Mode test actif : vous pouvez confirmer le paiement maintenant.'
                : 'Votre demande a été enregistrée. Votre abonnement sera activé dès validation du paiement par notre équipe.',
            'payment' => $payment,
            'simulator' => (bool) config('livrezone.payment_simulator'),
        ], 201);
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

        Mail::to($request->user()->email)->send(new PaymentConfirmedMail($updated));

        return response()->json([
            'message' => 'Paiement confirmé (mode test). Votre abonnement est actif !',
            'simulated' => true,
            'payment' => $updated,
        ]);
    }
}
