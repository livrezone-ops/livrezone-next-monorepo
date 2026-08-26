<?php

namespace App\Services;

use App\Models\Payment;
use Illuminate\Http\Request;

/**
 * Gestion des passerelles de paiement en ligne (CMI, Fatourati, ...).
 *
 * Fonctionnement :
 * - Chaque passerelle est activable via .env (CMI_ENABLED=1, FATOURATI_ENABLED=1).
 * - initiate() : crée la transaction chez la passerelle et retourne l'URL de redirection.
 * - confirm()  : appelé depuis le webhook/callback de la passerelle après vérification
 *                de la signature, délègue l'activation à AdminPaymentService::markPaid().
 *
 * Les implémentations concrètes (CMI, Fatourati) sont à venir : les méthodes
 * lèvent une exception tant qu'aucune passerelle n'est configurée.
 */
class PaymentGatewayService
{
    /** Clés .env de repli si aucun réglage admin n'a jamais été enregistré. */
    public const GATEWAY_ENV_KEYS = [
        'cmi' => 'CMI_ENABLED',
        'fatourati' => 'FATOURATI_ENABLED',
    ];

    public function __construct(
        protected AdminPaymentService $adminPaymentService,
        protected SubscriptionService $subscriptions,
    ) {
    }

    /**
     * Liste des passerelles activées (réglage admin prioritaire, repli .env).
     *
     * @return string[]
     */
    public function enabled(): array
    {
        return collect(self::GATEWAY_ENV_KEYS)
            ->filter(fn ($envKey, $gateway) => (bool) $this->subscriptions->setting(
                "gateway_{$gateway}",
                $envKey,
                false
            ))
            ->keys()
            ->values()
            ->all();
    }

    public function isEnabled(string $gateway): bool
    {
        return in_array($gateway, $this->enabled(), true);
    }

    /**
     * Initialise une transaction chez la passerelle et retourne l'URL de paiement.
     *
     * @return array{redirect_url: string}
     */
    public function initiate(Payment $payment, string $gateway): array
    {
        if (! $this->isEnabled($gateway)) {
            throw new \InvalidArgumentException("Passerelle non disponible : {$gateway}");
        }

        // TODO(CMI) : construire la requête de formulaire signée (amount, order id,
        // callback URL vers /api/payments/webhook/cmi) et retourner l'URL de redirection.
        // TODO(Fatourati) : idem selon l'API SunuLuxe/Fatourati.
        throw new \LogicException("La passerelle {$gateway} n'est pas encore intégrée.");
    }

    /**
     * Confirme un paiement suite à un webhook/callback vérifié.
     * Active l'abonnement (même logique que la validation admin).
     */
    public function confirmFromWebhook(Payment $payment): Payment
    {
        return $this->adminPaymentService->markPaid($payment);
    }

    /**
     * Vérifie la signature du webhook entrant.
     * À implémenter par passerelle avec leur mécanisme respectif (HMAC, etc.).
     */
    public function verifyWebhookSignature(string $gateway, Request $request): bool
    {
        $secret = config("livrezone.payment_webhooks.{$gateway}");

        if (! $secret) {
            return false;
        }

        // TODO(CMI/Fatourati) : vérifier le HMAC/hash selon la spec de chaque passerelle.
        return false;
    }
}
