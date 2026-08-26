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
  Mail,
  Search,
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
  payment_methods?: string[];
}

const RECEIPT_EMAIL = "mypaiement@livrezone.com";

const ALL_METHODS = [
  { val: "virement", label: "Virement bancaire", hint: "Coordonnées envoyées après validation de la demande." },
  { val: "especes", label: "Espèces", hint: "Paiement en main propre auprès de l'équipe." },
  { val: "cheque", label: "Chèque", hint: "Chèque libellé à l'ordre de LivreZone." },
  { val: "autre", label: "Autre moyen", hint: "Nous vous contacterons pour convenir ensemble." },
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
  const planLabel = plan === "pro" ? "Pro" : "Premium";

  const [pricing, setPricing] = useState<PricingConfig | null>(null);
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [method, setMethod] = useState("virement");
  const [coupon, setCoupon] = useState("");
  const debouncedCoupon = useDebounced(coupon, 450);
  const [preview, setPreview] = useState<{ amount: number; discount: number; coupon_valid: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<
    | { kind: "manual"; ref: string }
    | { kind: "activated" }
    | null
  >(null);

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

  // Aperçu serveur du montant : le prix affiché est toujours le prix réel
  // (réglages admin + coupon), même pendant la saisie du code.
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
        if (!cancelled) setPreview(null); // coupon invalide : retour au prix de base
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [plan, period, debouncedCoupon]);

  const config: PricingConfig = pricing ?? {
    pro_price: 30,
    premium_price: 50,
    pro_price_yearly: 300,
    premium_price_yearly: 500,
  };

  // Moyens manuels filtrés selon les réglages admin (tous si fallback).
  const availableMethods = pricing?.payment_methods
    ? ALL_METHODS.filter((m) => pricing.payment_methods!.includes(m.val))
    : ALL_METHODS;

  // Passerelles en ligne activées côté serveur (CMI, Fatourati...).
  const onlineGateways: string[] = pricing?.payment_gateways ?? [];
  const isGateway = ["cmi", "fatourati"].includes(method);

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

      if (data.flow === "online" && data.simulator) {
        // Simulateur : la passerelle est simulée, activation immédiate côté serveur.
        setResult({ kind: "activated" });
      } else {
        setResult({ kind: "manual", ref: `#${data.payment?.id ?? ""}` });
      }
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

  if (!user) {
    return <PendingAuthRedirect />;
  }

  /* ---------------- Écran de fin (manuel ou activation) ---------------- */
  if (result) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm max-w-lg w-full p-8 text-center">
          {result.kind === "activated" ? (
            <>
              <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto" />
              <h1 className="text-2xl font-black text-slate-900 mt-4">Paiement confirmé 🎉</h1>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Votre abonnement <strong>{planLabel}</strong> ({period === "yearly" ? "annuel" : "mensuel"},
                {" "}{amount} DH) est désormais <strong>actif</strong>. Un email de confirmation vous a été envoyé.
              </p>
            </>
          ) : (
            <>
              <Mail className="h-14 w-14 text-[#6D28D9] mx-auto" />
              <h1 className="text-2xl font-black text-slate-900 mt-4">Demande enregistrée — réf. {result.ref}</h1>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Votre abonnement <strong>{planLabel}</strong> ({period === "yearly" ? "annuel" : "mensuel"},
                {" "}{amount} DH) sera <strong>activé dès confirmation de votre paiement</strong>.
              </p>
              <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50/60 p-4 text-left">
                <p className="text-xs font-bold uppercase tracking-wider text-[#6D28D9] mb-1">
                  Étape importante
                </p>
                <p className="text-sm text-slate-700 leading-relaxed">
                  Après avoir effectué votre paiement, envoyez votre <strong>reçu par email</strong> à{" "}
                  <a href={`mailto:${RECEIPT_EMAIL}`} className="font-black text-[#6D28D9] underline break-all">
                    {RECEIPT_EMAIL}
                  </a>{" "}
                  en précisant votre référence <strong>{result.ref}</strong>.
                </p>
              </div>
            </>
          )}
          <div className="flex flex-col gap-2 mt-6">
            <Link
              href="/dashboard/paiements"
              className="rounded-xl bg-[#6D28D9] px-6 py-3 text-sm font-bold text-white hover:bg-violet-800 transition-colors"
            >
              {result.kind === "activated" ? "Gérer mon abonnement" : "Suivre ma demande"}
            </Link>
            <Link href="/tarification" className="text-xs font-bold text-gray-500 hover:text-gray-800">
              Retour aux offres
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- Formulaire ---------------- */
  const ctaLabel = submitting
    ? null
    : isGateway
      ? plan && period && method
        ? method === "cmi"
          ? "Continuer vers le paiement CMI"
          : "Obtenir mon code Fatourati"
        : "Continuer"
      : "Confirmer ma demande";

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
          Abonnement {planLabel}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Choisissez votre période et votre moyen de paiement.
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
            {pricing === null ? (
              /* Config pas encore chargée : ni liste ni flash de modes désactivés */
              <div className="flex justify-center py-3">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : availableMethods.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">Aucun moyen de paiement disponible actuellement.</p>
            ) : (
              availableMethods.map((m) => (
                <label
                  key={m.val}
                  className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
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
                    className="mt-0.5 text-[#6D28D9] focus:ring-[#6D28D9]"
                  />
                  <CreditCard className="h-4 w-4 text-gray-400 mt-0.5" />
                  <span>
                    <span className="block text-sm font-medium text-slate-800">{m.label}</span>
                    <span className="block text-xs text-gray-400">{m.hint}</span>
                  </span>
                </label>
              ))
            )}

            {/* Passerelles en ligne : visibles uniquement si activées côté serveur.
                Confirmation automatique via webhook, sans intervention admin. */}
            {onlineGateways.includes("cmi") && (
              <label className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${method === "cmi" ? "border-[#6D28D9] bg-violet-50/50" : "border-gray-200 hover:border-gray-300"}`}>
                <input type="radio" name="method" value="cmi" checked={method === "cmi"} onChange={() => setMethod("cmi")} className="mt-0.5 text-[#6D28D9] focus:ring-[#6D28D9]" />
                <CreditCard className="h-4 w-4 text-gray-400 mt-0.5" />
                <span>
                  <span className="block text-sm font-medium text-slate-800">Carte bancaire (CMI)</span>
                  <span className="block text-xs text-gray-400">Paiement sécurisé et activation instantanée.</span>
                </span>
              </label>
            )}
            {onlineGateways.includes("fatourati") && (
              <label className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${method === "fatourati" ? "border-[#6D28D9] bg-violet-50/50" : "border-gray-200 hover:border-gray-300"}`}>
                <input type="radio" name="method" value="fatourati" checked={method === "fatourati"} onChange={() => setMethod("fatourati")} className="mt-0.5 text-[#6D28D9] focus:ring-[#6D28D9]" />
                <CreditCard className="h-4 w-4 text-gray-400 mt-0.5" />
                <span>
                  <span className="block text-sm font-medium text-slate-800">Fatourati</span>
                  <span className="block text-xs text-gray-400">Payez avec votre code de paiement Fatourati.</span>
                </span>
              </label>
            )}
          </div>
        </div>

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

        {error && (
          <p className="mt-4 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3">{error}</p>
        )}

        {/* Récapitulatif + CTA unique */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mt-6">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Abonnement {planLabel}</span>
              <span className="text-sm font-bold text-slate-900">{baseAmount} DH</span>
            </div>
            {couponApplied && preview && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-600 font-bold">Réduction ({coupon.trim()})</span>
                <span className="text-xs font-bold text-emerald-600">−{preview.discount} DH</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-sm text-slate-600">
                Total {period === "yearly" ? "annuel" : "mensuel"}
              </span>
              <span className="text-2xl font-black text-slate-900">{amount} DH</span>
            </div>
          </div>

          {savingsLabel && (
            <p className="text-xs font-bold text-emerald-600 mt-2">{savingsLabel}</p>
          )}

          <button
            onClick={submit}
            disabled={submitting || availableMethods.length === 0}
            className="mt-5 w-full rounded-xl bg-[#6D28D9] px-6 py-3.5 text-sm font-bold text-white hover:bg-violet-800 transition-colors disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            ) : (
              ctaLabel ?? "Confirmer"
            )}
          </button>

          <p className="text-[11px] text-gray-400 mt-3 text-center">
            {isGateway
              ? "Vous serez redirigé vers la plateforme de paiement pour finaliser en toute sécurité."
              : "Un écran récapitulatif vous indiquera la marche à suivre pour finaliser."}
          </p>
        </div>
      </div>
    </div>
  );
}
