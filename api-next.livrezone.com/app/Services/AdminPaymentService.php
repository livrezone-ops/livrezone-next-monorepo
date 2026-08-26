<?php

namespace App\Services;

use App\Mail\PaymentConfirmedMail;
use App\Models\DiscountCode;
use App\Models\Payment;
use App\Models\Profile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Administration : paiements, échéances d'abonnement, promo et codes de réduction.
 */
class AdminPaymentService
{
    /**
     * Liste paginée des paiements avec filtres et agrégats.
     *
     * @return array{payments: array, meta: array}
     */
    public function list(array $filters = []): array
    {
        $query = Payment::query()->with('user.profile');

        $status = $filters['status'] ?? 'all';
        if ($status && $status !== 'all') {
            $query->where('status', $status);
        }

        $type = $filters['type'] ?? 'all';
        if ($type && $type !== 'all') {
            $query->where('subscription_type', $type);
        }

        if (! empty($filters['expiring'])) {
            $query->whereNotNull('expires_at')
                ->whereBetween('expires_at', [now(), now()->addDays(30)]);
        }

        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('transaction_id', 'like', "%{$search}%")
                    ->orWhereHas('user.profile', fn ($pq) => $pq->where('nickname', 'like', "%{$search}%"))
                    ->orWhereHas('user', fn ($uq) => $uq->where('email', 'like', "%{$search}%"));
            });
        }

        $sortBy = in_array($filters['sort_by'] ?? null, ['created_at', 'expires_at', 'amount'], true)
            ? $filters['sort_by']
            : 'created_at';
        $sortDir = ($filters['sort_dir'] ?? 'desc') === 'asc' ? 'asc' : 'desc';
        $query->orderBy($sortBy, $sortDir);

        $payments = $query->paginate(min((int) ($filters['limit'] ?? 20), 100));

        return [
            'payments' => collect($payments->items())
                ->map(fn (Payment $p) => $this->transformPayment($p))
                ->all(),
            'meta' => [
                'current_page' => $payments->currentPage(),
                'last_page' => $payments->lastPage(),
                'total' => $payments->total(),
                'stats' => $this->stats(),
            ],
        ];
    }

    private function transformPayment(Payment $p): array
    {
        return [
            'id' => $p->id,
            'user' => $p->user ? [
                'id' => $p->user->id,
                'email' => $p->user->email,
                'nickname' => $p->user->profile?->nickname,
                'subscription_type' => $p->user->profile?->subscription_type,
                'paused_from_type' => $p->user->profile?->paused_from_type,
            ] : null,
            'amount' => (float) $p->amount,
            'payment_method' => $p->payment_method,
            'transaction_id' => $p->transaction_id,
            'subscription_type' => $p->subscription_type,
            'status' => $p->status,
            'paid_at' => $p->paid_at?->toISOString(),
            'expires_at' => $p->expires_at?->toISOString(),
            'created_at' => $p->created_at?->toISOString(),
        ];
    }

    private function stats(): array
    {
        return [
            'revenue_paid' => (float) Payment::where('status', 'paid')->sum('amount'),
            'count_paid' => Payment::where('status', 'paid')->count(),
            'count_pending' => Payment::where('status', 'pending')->count(),
            'count_failed' => Payment::where('status', 'failed')->count(),
            // Échéances dans les 30 prochains jours
            'expiring_soon' => Payment::where('status', 'paid')
                ->whereNotNull('expires_at')
                ->whereBetween('expires_at', [now(), now()->addDays(30)])
                ->count(),
        ];
    }

    /**
     * Valide un paiement : l'abonnement correspondant est activé pour la
     * période choisie (1 mois ou 12 mois à compter de maintenant).
     * L'email de confirmation part UNIQUEMENT après l'activation effective,
     * quel que soit le déclencheur (admin, simulateur, webhook passerelle).
     */
    public function markPaid(Payment $payment): Payment
    {
        if ($payment->status === 'paid') {
            return $payment;
        }

        $updated = DB::transaction(function () use ($payment) {
            $months = ($payment->period ?? 'monthly') === 'yearly' ? 12 : 1;

            $payment->update([
                'status' => 'paid',
                'paid_at' => now(),
                'expires_at' => now()->addMonths($months),
            ]);

            Profile::where('user_id', $payment->user_id)
                ->update(['subscription_type' => $payment->subscription_type]);

            // Consomme le coupon utilisé, une seule fois.
            if ($payment->discount_code) {
                DiscountCode::where('code', $payment->discount_code)
                    ->increment('times_used');
            }

            return $payment->fresh();
        });

        // Email après commit : un échec d'envoi n'annule jamais l'activation.
        if ($updated->user?->email) {
            try {
                Mail::to($updated->user->email)
                    ->send(new PaymentConfirmedMail($updated));
            } catch (\Throwable $e) {
                Log::error('Email de confirmation de paiement non envoyé : '.$e->getMessage());
            }
        }

        return $updated;
    }

    // ------------------------------------------------------------------
    // Codes de réduction
    // ------------------------------------------------------------------

    public function listDiscountCodes(): array
    {
        return DiscountCode::query()->orderByDesc('created_at')->get()->map(
            fn (DiscountCode $c) => $c->toArray()
        )->all();
    }

    public function createDiscountCode(array $data): DiscountCode
    {
        return DiscountCode::create([
            'code' => strtoupper($data['code']),
            'type' => $data['type'],
            'value' => $data['value'],
            'is_active' => $data['is_active'] ?? true,
            'expires_at' => $data['expires_at'] ?? null,
            'max_uses' => $data['max_uses'] ?? null,
        ]);
    }

    public function updateDiscountCode(DiscountCode $code, array $data): DiscountCode
    {
        $code->update(collect($data)->only([
            'code', 'type', 'value', 'is_active', 'expires_at', 'max_uses',
        ])->filter(fn ($v) => $v !== null)->all());

        return $code->fresh();
    }

    public function deleteDiscountCode(DiscountCode $code): void
    {
        $code->delete();
    }
}
