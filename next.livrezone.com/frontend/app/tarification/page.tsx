'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import { Loader2, CheckCircle2, Star, Zap, ShieldCheck } from 'lucide-react';
import Logo from '@/components/Logo';
import Link from 'next/link';

interface PricingConfig {
    max_free_listings: number;
    pro_price: number;
    premium_price: number;
    pro_price_yearly?: number;
    premium_price_yearly?: number;
    promo_pro_free: boolean;
    pro_notification_delay_hours: number;
}

export default function TarificationPage() {
    const { user, isAuthenticated } = useAuth();
    const [pricing, setPricing] = useState<PricingConfig | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const { data } = await api.get('/reference-data');
                if (data.pricing) {
                    setPricing(data.pricing);
                }
            } catch (error) {
                console.error("Failed to fetch pricing config", error);
            } finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, []);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="flex items-center gap-3 text-slate-600">
                    <Loader2 className="h-6 w-6 animate-spin text-[#6D28D9]" />
                    <span className="text-sm font-medium">Chargement des offres...</span>
                </div>
            </div>
        );
    }

    // Valeurs par défaut si l'API échoue
    const config = pricing || {
        max_free_listings: 25,
        pro_price: 30,
        premium_price: 50,
        pro_price_yearly: 300,
        premium_price_yearly: 500,
        promo_pro_free: false,
        pro_notification_delay_hours: 3
    };

    const isCurrentPlan = (plan: string) => {
        if (!user || !user.profile) return false;
        return user.profile.subscription_type === plan;
    };

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
                <div className="text-center">
                    <Logo size="lg" className="mx-auto mb-6" />
                    <h2 className="text-3xl font-black text-slate-900 sm:text-4xl">
                        Des tarifs simples et transparents
                    </h2>
                    <p className="mt-4 text-lg text-slate-600">
                        Choisissez l&apos;offre qui correspond le mieux à vos besoins de vente sur LivreZone.
                    </p>
                </div>

                <div className="mt-16 grid gap-8 lg:grid-cols-3 lg:gap-12">
                    {/* Free Tier */}
                    <div className={`relative flex flex-col rounded-3xl border ${isCurrentPlan('free') ? 'border-[#6D28D9] shadow-xl shadow-purple-500/10' : 'border-slate-200 shadow-sm'} bg-white p-8`}>
                        {isCurrentPlan('free') && (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-[#6D28D9] px-4 py-1 text-xs font-bold uppercase tracking-wide text-white">
                                Votre offre actuelle
                            </div>
                        )}
                        <div className="mb-6">
                            <h3 className="text-2xl font-bold text-slate-900">Free</h3>
                            <p className="mt-2 text-sm text-slate-500">Pour les vendeurs occasionnels</p>
                            <div className="mt-4 flex items-baseline text-5xl font-black tracking-tight text-slate-900">
                                0 <span className="ml-1 text-xl font-semibold text-slate-500">DH</span>
                                <span className="ml-1 text-lg font-medium text-slate-500">/mois</span>
                            </div>
                        </div>
                        <ul className="mb-8 flex-1 space-y-4 text-sm text-slate-600">
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                                <span>Jusqu&apos;à <strong className="text-slate-900">{config.max_free_listings} annonces</strong> gratuites</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                                <span>Messagerie interne standard</span>
                            </li>
                        </ul>
                        {isAuthenticated && !isCurrentPlan('free') ? (
                            <button disabled className="mt-auto block w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-6 py-3 text-center text-sm font-semibold text-slate-400">
                                Offre inférieure
                            </button>
                        ) : (
                            <button disabled={isCurrentPlan('free')} className="mt-auto block w-full rounded-xl bg-slate-100 px-6 py-3 text-center text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed">
                                {isCurrentPlan('free') ? 'Actif' : 'Commencer gratuitement'}
                            </button>
                        )}
                    </div>

                    {/* Pro Tier */}
                    <div className={`relative flex flex-col rounded-3xl border ${isCurrentPlan('pro') ? 'border-[#6D28D9] shadow-xl shadow-purple-500/10' : 'border-indigo-500 shadow-xl shadow-indigo-500/10'} bg-white p-8`}>
                        {isCurrentPlan('pro') ? (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-[#6D28D9] px-4 py-1 text-xs font-bold uppercase tracking-wide text-white">
                                Votre offre actuelle
                            </div>
                        ) : config.promo_pro_free && (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-rose-500 px-4 py-1 text-xs font-bold uppercase tracking-wide text-white animate-pulse">
                                Promo spéciale !
                            </div>
                        )}
                        <div className="mb-6">
                            <div className="flex items-center gap-2">
                                <Star className="h-6 w-6 text-indigo-500" />
                                <h3 className="text-2xl font-bold text-slate-900">Pro</h3>
                            </div>
                            <p className="mt-2 text-sm text-slate-500">Pour les vendeurs réguliers</p>
                            <div className="mt-4 flex flex-col">
                                {config.promo_pro_free ? (
                                    <>
                                        <div className="flex items-baseline text-5xl font-black tracking-tight text-slate-900">
                                            0 <span className="ml-1 text-xl font-semibold text-slate-500">DH</span>
                                            <span className="ml-1 text-lg font-medium text-slate-500">/mois</span>
                                        </div>
                                        <span className="text-sm text-slate-500 line-through mt-1">{config.pro_price} DH /mois</span>
                                    </>
                                ) : (
                                    <div className="flex items-baseline text-5xl font-black tracking-tight text-slate-900">
                                        {config.pro_price} <span className="ml-1 text-xl font-semibold text-slate-500">DH</span>
                                        <span className="ml-1 text-lg font-medium text-slate-500">/mois</span>
                                    </div>
                                )}
                                <span className="text-xs text-slate-400 mt-1">
                                    Ou {config.pro_price_yearly} DH/an — 2 mois offerts
                                </span>
                            </div>
                        </div>
                        <ul className="mb-8 flex-1 space-y-4 text-sm text-slate-600">
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 shrink-0 text-indigo-500" />
                                <span><strong className="text-slate-900">Annonces illimitées</strong></span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 shrink-0 text-indigo-500" />
                                <span>Réception des commandes par <strong>Email et Messagerie</strong></span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 shrink-0 text-indigo-500" />
                                <span>Notification de commande sous <strong>{config.pro_notification_delay_hours}h</strong></span>
                            </li>
                        </ul>
                        {isCurrentPlan('pro') ? (
                            <button disabled className="mt-auto block w-full rounded-xl bg-indigo-600 px-6 py-3 text-center text-sm font-semibold text-white opacity-50 cursor-not-allowed">
                                Actif
                            </button>
                        ) : (
                            <Link href={`/tarification/paiement?type=pro`} className="mt-auto block w-full rounded-xl bg-indigo-600 px-6 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-indigo-700">
                                Passer à l&apos;offre Pro
                            </Link>
                        )}
                    </div>

                    {/* Premium Tier */}
                    <div className={`relative flex flex-col rounded-3xl border ${isCurrentPlan('premium') ? 'border-[#6D28D9] shadow-xl shadow-purple-500/10' : 'border-amber-400 shadow-xl shadow-amber-500/10 bg-gradient-to-b from-amber-50/50 to-white'} p-8`}>
                        {isCurrentPlan('premium') && (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-[#6D28D9] px-4 py-1 text-xs font-bold uppercase tracking-wide text-white">
                                Votre offre actuelle
                            </div>
                        )}
                        <div className="mb-6">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-6 w-6 text-amber-500" />
                                <h3 className="text-2xl font-bold text-slate-900">Premium</h3>
                            </div>
                            <p className="mt-2 text-sm text-slate-500">L&apos;expérience ultime sans compromis</p>
                            <div className="mt-4 flex items-baseline text-5xl font-black tracking-tight text-slate-900">
                                {config.premium_price} <span className="ml-1 text-xl font-semibold text-slate-500">DH</span>
                                <span className="ml-1 text-lg font-medium text-slate-500">/mois</span>
                            </div>
                        </div>
                        <ul className="mb-8 flex-1 space-y-4 text-sm text-slate-600">
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 shrink-0 text-amber-500" />
                                <span><strong className="text-slate-900">Annonces illimitées</strong></span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 shrink-0 text-amber-500" />
                                <span>Commandes par <strong>Email, Messagerie et Telegram</strong></span>
                            </li>
                            <li className="flex items-start gap-3">
                                <Zap className="h-5 w-5 shrink-0 text-amber-500" />
                                <span>Notification de commande <strong>Immédiate</strong></span>
                            </li>
                        </ul>
                        {isCurrentPlan('premium') ? (
                            <button disabled className="mt-auto block w-full rounded-xl bg-amber-500 px-6 py-3 text-center text-sm font-semibold text-white opacity-50 cursor-not-allowed">
                                Actif
                            </button>
                        ) : (
                            <Link href={`/tarification/paiement?type=premium`} className="mt-auto block w-full rounded-xl bg-amber-500 px-6 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-amber-600">
                                Passer à l&apos;offre Premium
                            </Link>
                        )}
                    </div>
                </div>
                
                {!isAuthenticated && (
                    <div className="mt-12 text-center">
                        <p className="text-slate-600 mb-4">Prêt à commencer à vendre ?</p>
                        <Link href="/login" className="inline-flex items-center justify-center rounded-xl bg-[#6D28D9] px-8 py-3 text-sm font-semibold text-white hover:bg-[#5b21b6] transition-colors">
                            Créer un compte gratuit
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
