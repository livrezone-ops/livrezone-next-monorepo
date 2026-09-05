'use client';

/*
 * Page de consentement CGV — étape intermédiaire entre la connexion via un
 * provider (Google…) et la complétion de profil. Uniquement pour les NOUVEAUX
 * utilisateurs : le backend a reconnu qu'aucun compte n'existe (provider_id /
 * email) et n'a RIEN enregistré — il a transmis les données du provider dans un
 * jeton chiffré (?token=). Le compte n'est créé qu'après acceptation des CGV ;
 * si l'utilisateur annule, rien n'est enregistré.
 */

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { getApiErrorMessage } from '../../../lib/api-error';
import api from '../../../lib/axios';
import {
    Loader2,
    AlertTriangle,
    ArrowLeft,
    Mail,
    User as UserIcon,
    ShieldCheck,
} from 'lucide-react';
import Logo from '@/components/Logo';
import CgvCheckbox from '@/components/CgvCheckbox';

type PendingSignup = {
    provider: string;
    name: string;
    email: string;
    avatar: string | null;
};

const providerLabels: Record<string, string> = {
    google: 'Google',
    facebook: 'Facebook',
};

function ConsentForm() {
    const { acceptProviderConsent } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [pending, setPending] = useState<PendingSignup | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [fatal, setFatal] = useState('');
    const [acceptedCgv, setAcceptedCgv] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token) return;
        let cancelled = false;
        api.get<PendingSignup>('/auth/provider/consent/pending', {
            params: { token },
        })
            .then(({ data }) => {
                if (!cancelled) setPending(data);
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    setFatal(
                        getApiErrorMessage(
                            err,
                            "Demande d'inscription expirée ou invalide. Veuillez recommencer la connexion.",
                        ),
                    );
                }
            })
            .finally(() => {
                if (!cancelled) setLoaded(true);
            });
        return () => {
            cancelled = true;
        };
    }, [token]);

    const handleAccept = async (event: FormEvent) => {
        event.preventDefault();

        if (!acceptedCgv) {
            setError(
                'Vous devez accepter les Conditions Générales pour créer votre compte.',
            );
            return;
        }

        setError('');
        setSubmitting(true);

        try {
            const data = await acceptProviderConsent(token as string);
            router.replace(data.redirect || '/dashboard');
        } catch (err) {
            setError(
                getApiErrorMessage(
                    err,
                    'Impossible de créer le compte. Veuillez réessayer.',
                ),
            );
        } finally {
            setSubmitting(false);
        }
    };

    // Conteneur commun (même coquille que /login)
    const renderShell = (content: React.ReactNode) => (
        <div className="flex-1 flex flex-col items-center justify-start bg-gradient-to-b from-slate-50 via-slate-50 to-purple-50/20 px-4 pt-5 pb-12 sm:pt-7 sm:pb-16">
            <div className="w-full max-w-[680px]">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 md:p-9 shadow-xl shadow-slate-100/80">
                    <div className="mb-5 text-center">
                        <div className="flex justify-center">
                            <Logo size="lg" href="/" />
                        </div>
                        <p className="mt-2 text-xs sm:text-sm text-slate-500 font-medium">
                            La plateforme d’achat et vente de livres d’occasion
                        </p>
                    </div>
                    {content}
                </div>
                <p className="mt-5 text-center text-[11px] text-slate-400 leading-tight">
                    En créant un compte, vous acceptez nos{' '}
                    <Link href="/cgv" className="text-slate-500 hover:underline">
                        Conditions Générales
                    </Link>{' '}
                    et notre{' '}
                    <Link
                        href="/confidentialite"
                        className="text-slate-500 hover:underline"
                    >
                        Politique de confidentialité
                    </Link>
                    .
                </p>
            </div>
        </div>
    );

    const renderBackButton = () => (
        <Link
            href="/login"
            className="mt-2.5 flex w-full items-center justify-center gap-2 text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
            <ArrowLeft className="h-4 w-4" />
            Retour à la connexion
        </Link>
    );

    const renderErrorCard = (message: string) =>
        renderShell(
            <div className="space-y-4">
                <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-xs text-rose-700 shadow-2xs">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                    <div className="flex-1 font-medium">{message}</div>
                </div>
                {renderBackButton()}
            </div>,
        );

    // Lien invalide / sans jeton
    if (!token) {
        return renderErrorCard(
            'Lien de consentement invalide. Veuillez vous connecter à nouveau.',
        );
    }

    // Chargement de l'aperçu
    if (!loaded) {
        return renderShell(
            <div className="flex items-center justify-center gap-3 py-8 text-slate-600">
                <Loader2 className="h-6 w-6 animate-spin text-[#6D28D9]" />
                <span className="text-sm font-medium">Chargement...</span>
            </div>,
        );
    }

    // Jeton expiré / invalide côté API
    if (fatal) {
        return renderErrorCard(fatal);
    }

    const providerLabel =
        providerLabels[pending?.provider ?? ''] ?? pending?.provider ?? '';

    return renderShell(
        <form onSubmit={handleAccept} className="space-y-4">
            <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-[#6D28D9]">
                    <ShieldCheck className="h-6 w-6" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Dernière étape avant votre inscription
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-relaxed">
                    Aucun compte n&apos;existe encore avec ces informations.
                    Acceptez les conditions générales pour finaliser la création
                    de votre compte{providerLabel ? ` via ${providerLabel}` : ''}
                    .
                </p>
            </div>

            {/* Identité renvoyée par le provider (non enregistrée à ce stade) */}
            <div className="space-y-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-700">
                    <UserIcon className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="font-semibold text-slate-900">
                        {pending?.name}
                    </span>
                </div>
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-700">
                    <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                    <span>{pending?.email}</span>
                </div>
            </div>

            {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-xs text-rose-700 shadow-2xs">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                    <div className="flex-1 font-medium">{error}</div>
                </div>
            )}

            <CgvCheckbox
                id="consent-cgv"
                accepted={acceptedCgv}
                onChange={setAcceptedCgv}
                className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"
            />

            <button
                type="submit"
                disabled={submitting}
                className="flex w-full h-12 items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-5 text-sm font-semibold text-white shadow-xs transition-all hover:bg-[#5b21b6] hover:shadow-md hover:shadow-purple-500/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
                {submitting ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Création du compte...</span>
                    </>
                ) : (
                    <>
                        <ShieldCheck className="h-4 w-4" />
                        <span>Accepter et créer mon compte</span>
                    </>
                )}
            </button>

            {/* Annulation : aucune donnée n'est enregistrée */}
            <button
                type="button"
                onClick={() => router.replace('/login')}
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-60"
            >
                <ArrowLeft className="h-4 w-4" />
                Annuler (ne pas créer de compte)
            </button>
        </form>,
    );
}

export default function ConsentPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-slate-50">
                    <div className="flex items-center gap-3 text-slate-600">
                        <Loader2 className="h-6 w-6 animate-spin text-[#6D28D9]" />
                        <span className="text-sm font-medium">
                            Chargement...
                        </span>
                    </div>
                </div>
            }
        >
            <ConsentForm />
        </Suspense>
    );
}
