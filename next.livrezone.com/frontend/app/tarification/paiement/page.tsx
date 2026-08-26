"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BadgePercent,
  CheckCircle2,
  CreditCard,
  Loader2,
} from "lucide-react";
import api from "@/lib/axios";
import { useAuth } from "@/hooks/useAuth";
import { useDebounced } from "@/hooks/useDebounced";
import PendingAuthRedirect from "@/components/PendingAuthRedirect";

interface PricingConfig {
  pro_price: number;
  premium_price: number;
  pro_price_yearly: number;
  premium_price_yearly: number;
  payment_gateways?: string[];
}

const METHODS = [
  { val: "virement", label: "Virement bancaire" },
  { val: "especes", label: "Espèces (en librairie partenaire)" },
  { val: "cheque", label: "Chèque" },
  { val: "autre", label: "Autre moyen" },
];

export default function PaiementPage() {
  return (
    <Suspense fallback={null}>
      <PaiementContent />
    </Suspense>
  );
}

function PaiementContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const plan = searchParams.get("type") === "premium" ? "premium" : "pro";

  const [pricing, setPricing] = useState<PricingConfig | null>(null);
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [method, setMethod] = useState("virement");
  const [coupon, setCoupon] = useState("");
  const debouncedCoupon = useDebounced(coupon, 450);
  const [preview, setPreview] = useState<{ amount: number; discount: number; coupon_valid: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [activated, setActivated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPaymentId, setPendingPaymentId] = useState<number | null>(null);
  const [simulator, setSimulator] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data } = await api.get("/reference-data");
        if (!cancelled && data.pricing) setPricing(data.pricing);
      } catch {
        // Le fallback statique ci-dessous prend le relais
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Aperçu serveur du montant : se met à jour dès que la période ou le
  // coupon (stabilisé) change — le prix affiché est toujours le prix réel.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data } = await api.post("/payments/preview", {
          subscription_type: plan,
          period,
          discount_code: debouncedCoupon.trim() || undefined,
        });
        if (!cancelled) setPreview(data);
      } catch {
        if (!cancelled) setPreview(null); // coupon invalide : on retombe sur le prix de base
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [plan, period, debouncedCoupon]);

  // Passerelles en ligne activées côté serveur (CMI, Fatourati...)
  const onlineGateways: string[] = pricing?.payment_gateways ?? [];

  const config: PricingConfig = pricing ?? {
    pro_price: 30,
    premium_price: 50,
    pro_price_yearly: 300,
    premium_price_yearly: 500,
  };

  // Montant affiché = aperçu serveur (coupon appliqué) sinon prix de base.
  const monthly = plan === "pro" ? config.pro_price : config.premium_price;
  const yearly = plan === "pro" ? config.pro_price_yearly : config.premium_price_yearly;
  const baseAmount = period === "yearly" ? yearly : monthly;
  const amount = preview?.amount ?? baseAmount;
  const couponApplied = (preview?.discount ?? 0) > 0;

  const savingsLabel = useMemo(() => {
    if (period !== "yearly") return null;
    const saved = monthly * 12 - yearly;
    return `Vous économisez ${saved} DH — soit 2 mois offerts`;
  }, [period, monthly, yearly]);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.post("/payments", {
        subscription_type: plan,
        period,
        payment_method: method,
        discount_code: coupon.trim() || undefined,
      });
      setPendingPaymentId(data.payment?.id ?? null);
      setSimulator(!!data.simulator);
      if (!data.simulator) setDone(true);
    } catch (err: unknown) {
      const resp = err as { response?: { status?: number; data?: { message?: string; errors?: Record<string, string[]> } } };
      if (resp.response?.status === 422) {
        const errors = resp.response.data?.errors;
        setError(errors ? Object.values(errors)[0][0] : resp.response.data?.message ?? "Demande refusée.");
      } else {
        setError("Erreur réseau. Réessayez.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const simulatePayment = async () => {
    if (!pendingPaymentId) return;
    setConfirming(true);
    setError(null);
    try {
      await api.post(`/payments/${pendingPaymentId}/simulate-confirm`);
      setActivated(true);
      setDone(true);
    } catch (err: unknown) {
      const resp = err as { response?: { data?: { message?: string } } };
      setError(resp.response?.data?.message ?? "Erreur lors de la simulation.");
    } finally {
      setConfirming(false);
    }
  };

  if (!user) {
    return <PendingAuthRedirect />;
  }

  if (done) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm max-w-md w-full p-8 text-center">
          <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto" />
          <h1 className="text-2xl font-black text-slate-900 mt-4">
            {activated ? "Paiement confirmé, abonnement actif !" : "Demande enregistrée !"}
          </h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            {activated ? (
              <>
                Votre abonnement <strong>{plan === "pro" ? "Pro" : "Premium"}</strong> ({period === "yearly" ? "annuel" : "mensuel"},
                {" "}{amount} DH) est désormais actif. Un email de confirmation vous a été envoyé.
              </>
            ) : (
              <>
                Votre abonnement <strong>{plan === "pro" ? "Pro" : "Premium"}</strong> ({period === "yearly" ? "annuel" : "mensuel"},
                {" "}{amount} DH) sera activé dès validation de votre paiement par notre équipe.
              </>
            )}
          </p>
          <div className="flex flex-col gap-2 mt-6">
            <Link
              href="/dashboard/paiements"
              className="rounded-xl bg-[#6D28D9] px-6 py-3 text-sm font-bold text-white hover:bg-violet-800 transition-colors"
            >
              Suivre ma demande
            </Link>
            <Link
              href="/tarification"
              className="text-xs font-bold text-gray-500 hover:text-gray-800"
            >
              Retour aux offres
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/tarification"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Retour aux offres
        </Link>

        <h1 className="text-3xl font-black text-slate-900">
          Abonnement {plan === "pro" ? "Pro" : "Premium"}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Choisissez votre période et votre moyen de paiement. Votre abonnement sera activé dès réception et validation par notre équipe.
        </p>

        {/* Choix de période */}
        <div className="grid sm:grid-cols-2 gap-4 mt-8">
          <button
            type="button"
            onClick={() => setPeriod("monthly")}
            className={`relative rounded-2xl border p-5 text-left transition-all cursor-pointer ${
              period === "monthly"
                ? "border-[#6D28D9] bg-white shadow-md ring-2 ring-[#6D28D9]/20"
                : "border-gray-200 bg-white hover:border-[#6D28D9]/40"
            }`}
          >
            <p className="font-black text-sm uppercase tracking-wide text-slate-900">Mensuel</p>
            <p className="text-3xl font-black text-slate-900 mt-2">
              {monthly} <span className="text-base font-semibold text-slate-500">DH/mois</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">Sans engagement, renouvelable chaque mois.</p>
          </button>

          <button
            type="button"
            onClick={() => setPeriod("yearly")}
            className={`relative rounded-2xl border p-5 text-left transition-all cursor-pointer ${
              period === "yearly"
                ? "border-[#F97316] bg-orange-50/40 shadow-md ring-2 ring-[#F97316]/20"
                : "border-gray-200 bg-white hover:border-[#F97316]/40"
            }`}
          >
            <span className="absolute -top-3 right-4 inline-flex items-center gap-1 rounded-full bg-[#F97316] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
              <BadgePercent className="h-3 w-3" /> 2 mois offerts
            </span>
            <p className="font-black text-sm uppercase tracking-wide text-slate-900">Annuel</p>
            <p className="text-3xl font-black text-slate-900 mt-2">
              {yearly} <span className="text-base font-semibold text-slate-500">DH/an</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Soit {(yearly / 12).toFixed(0)} DH/mois au lieu de {monthly} DH.
            </p>
          </button>
        </div>

        {/* Moyens de paiement */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mt-6">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
            Moyen de paiement
          </label>
          <div className="space-y-2">
            {METHODS.map((m) => (
              <label
                key={m.val}
                className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                  method === m.val
                    ? "border-[#6D28D9] bg-violet-50/50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="method"
                  value={m.val}
                  checked={method === m.val}
                  onChange={() => setMethod(m.val)}
                  className="text-[#6D28D9] focus:ring-[#6D28D9]"
                />
                <CreditCard className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-slate-800">{m.label}</span>
              </label>
            ))}

            {/* Passerelles en ligne : visibles uniquement si activées côté serveur.
                Le paiement y est automatique (webhook), contrairement au virement/espèces
                qui nécessitent la validation manuelle de l'admin. */}
            {onlineGateways.includes("cmi") && (
              <label className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${method === "cmi" ? "border-[#6D28D9] bg-violet-50/50" : "border-gray-200 hover:border-gray-300"}`}>
                <input type="radio" name="method" value="cmi" checked={method === "cmi"} onChange={() => setMethod("cmi")} className="text-[#6D28D9] focus:ring-[#6D28D9]" />
                <CreditCard className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-slate-800">Carte bancaire (CMI) — paiement instantané</span>
              </label>
            )}
            {onlineGateways.includes("fatourati") && (
              <label className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${method === "fatourati" ? "border-[#6D28D9] bg-violet-50/50" : "border-gray-200 hover:border-gray-300"}`}>
                <input type="radio" name="method" value="fatourati" checked={method === "fatourati"} onChange={() => setMethod("fatourati")} className="text-[#6D28D9] focus:ring-[#6D28D9]" />
                <CreditCard className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-slate-800">Fatourati — paiement instantané</span>
              </label>
            )}
          </div>
          {onlineGateways.length === 0 && (
            <p className="text-[11px] text-gray-400 mt-3">
              Le paiement par carte en ligne sera bientôt disponible. En attendant, choisissez virement ou espèces : l&apos;équipe valide votre abonnement après réception.
            </p>
          )}
        </div>

        {error && (
          <p className="mt-4 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3">{error}</p>
        )}

        {/* Coupon de réduction avec aperçu live */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mt-6">
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
            <BadgePercent className="h-4 w-4 text-[#F97316]" /> Code de réduction (optionnel)
          </label>
          <input
            type="text"
            value={coupon}
            onChange={(e) => setCoupon(e.target.value.toUpperCase())}
            placeholder="Ex : BIENVENUE10"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm uppercase focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/40 focus:border-[#6D28D9]"
          />
          {debouncedCoupon.trim() !== "" && preview && (
            couponApplied ? (
              <p className="mt-2 text-xs font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Code appliqué : −{preview.discount} DH sur le total
              </p>
            ) : (
              <p className="mt-2 text-xs font-bold text-rose-600">
                Code invalide ou expiré — le prix affiché ne tient pas compte du code.
              </p>
            )
          )}
        </div>

        {/* Récapitulatif + CTA */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mt-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">
              Total {period === "yearly" ? "annuel" : "mensuel"}
            </span>
            <span className="text-2xl font-black text-slate-900">{amount} DH</span>
          </div>
          {couponApplied && preview && (
            <p className="text-xs text-slate-500 mt-1">
              <span className="line-through">{baseAmount} DH</span>{" "}
              <span className="font-bold text-emerald-600">−{preview.discount} DH avec le code</span>
            </p>
          )}
          {savingsLabel && (
            <p className="text-xs font-bold text-emerald-600 mt-1">{savingsLabel}</p>
          )}
          <button
            onClick={submit}
            disabled={submitting}
            className="mt-5 w-full rounded-xl bg-[#6D28D9] px-6 py-3.5 text-sm font-bold text-white hover:bg-violet-800 transition-colors disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            ) : simulator ? (
              "Créer la transaction (mode test)"
            ) : (
              "Envoyer ma demande d'abonnement"
            )}
          </button>
          <p className="text-[11px] text-gray-400 mt-3 text-center">
            {simulator
              ? "Mode test actif : le paiement sera simulé, sans passerelle réelle."
              : "Aucun débit automatique : notre équipe vous contactera pour finaliser le paiement."}
          </p>

          {simulator && pendingPaymentId && !done && (
            <button
              onClick={simulatePayment}
              disabled={confirming}
              className="mt-3 w-full rounded-xl bg-[#F97316] px-6 py-3.5 text-sm font-bold text-white hover:bg-[#EA580C] transition-colors disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
            >
              {confirming ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              ) : (
                "Payer maintenant (simulation)"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
