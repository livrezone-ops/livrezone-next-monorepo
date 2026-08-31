'use client';

import { Suspense, FormEvent, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { getApiErrorMessage } from '../../lib/api-error';
import {
    BookOpen,
    Lock,
    Mail,
    Eye,
    EyeOff,
    AlertTriangle,
    CheckCircle2,
    Loader2,
    ArrowLeft,
    KeyRound,
} from 'lucide-react';

export default function ResetPasswordPage() {
    // useSearchParams requiert une frontière Suspense pour le pré-rendu statique.
    return (
        <Suspense
            fallback={
                <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-slate-50 to-purple-50/20">
                    <Loader2 className="animate-spin h-8 w-8 text-[#6D28D9]" />
                </div>
            }
        >
            <ResetPasswordForm />
        </Suspense>
    );
}

function ResetPasswordForm() {
    const { resetPassword } = useAuth();
    const searchParams = useSearchParams();

    // Token/email lus depuis l'URL via useSearchParams : SSR-safe et cohérent
    // entre rendu serveur et hydratation (plus de setState dans un effet).
    const token = searchParams.get('token') ?? '';
    const [email, setEmail] = useState(searchParams.get('email') ?? '');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);

    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();

        if (password.length < 8) {
            setError('Le mot de passe doit contenir au moins 8 caractères.');
            return;
        }

        if (password !== passwordConfirmation) {
            setError('Les mots de passe ne correspondent pas.');
            return;
        }

        setError('');
        setMessage('');
        setPending(true);

        try {
            await resetPassword(token, email, password, passwordConfirmation);
            setMessage('Votre mot de passe a été réinitialisé avec succès ! Vous pouvez maintenant vous connecter.');
            setPassword('');
            setPasswordConfirmation('');
        } catch (err) {
            setError(
                getApiErrorMessage(
                    err,
                    'Échec de la réinitialisation du mot de passe. Le lien a peut-être expiré.',
                ),
            );
        } finally {
            setPending(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-start bg-gradient-to-b from-slate-50 via-slate-50 to-purple-50/20 px-4 pt-5 pb-12 sm:pt-7 sm:pb-16">
            <div className="w-full max-w-[480px]">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-lg shadow-slate-100">
                    
                    {/* Header Logo + Titre */}
                    <div className="mb-6 text-center">
                        <Link href="/" className="inline-flex items-center gap-2 group transition-transform hover:scale-[1.02]">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#6D28D9] text-white shadow-sm shadow-purple-500/20">
                                <BookOpen className="h-5 w-5" />
                            </div>
                            <span className="text-xl font-black tracking-tight text-slate-900">
                                Livre<span className="text-[#6D28D9]">Zone</span>
                            </span>
                        </Link>
                        <h1 className="mt-3 text-base font-bold text-slate-900">
                            Nouveau mot de passe
                        </h1>
                        <p className="mt-1 text-xs text-slate-500 font-medium">
                            Définissez un nouveau mot de passe pour votre compte
                        </p>
                    </div>

                    {/* Messages d'erreur & succès */}
                    {error && (
                        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-xs text-rose-700 shadow-2xs">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                            <div className="flex-1 font-medium">{error}</div>
                        </div>
                    )}

                    {message && (
                        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/90 p-3 text-xs text-emerald-800 shadow-2xs">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                            <div className="flex-1 font-medium">{message}</div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-3.5">
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-700">
                                Adresse email
                            </label>
                            <div className="relative">
                                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-3.5 text-xs sm:text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#6D28D9] focus:bg-white focus:ring-2 focus:ring-[#6D28D9]/20"
                                    placeholder="votre@email.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-700">
                                Nouveau mot de passe
                            </label>
                            <div className="relative">
                                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    minLength={8}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-10 text-xs sm:text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#6D28D9] focus:bg-white focus:ring-2 focus:ring-[#6D28D9]/20"
                                    placeholder="Minimum 8 caractères"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                                    tabIndex={-1}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-700">
                                Confirmer le nouveau mot de passe
                            </label>
                            <div className="relative">
                                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type={showPasswordConfirm ? 'text' : 'password'}
                                    required
                                    minLength={8}
                                    value={passwordConfirmation}
                                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-10 text-xs sm:text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#6D28D9] focus:bg-white focus:ring-2 focus:ring-[#6D28D9]/20"
                                    placeholder="Répétez le mot de passe"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                                    tabIndex={-1}
                                >
                                    {showPasswordConfirm ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={pending || !token}
                            className="mt-2 flex w-full h-11 items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs transition-all hover:bg-[#5b21b6] hover:shadow-md hover:shadow-purple-500/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {pending ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Enregistrement...</span>
                                </>
                            ) : (
                                <>
                                    <KeyRound className="h-4 w-4" />
                                    <span>Mettre à jour le mot de passe</span>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-5 text-center">
                        <Link
                            href="/login"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#6D28D9] transition-colors"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Retour à la page de connexion
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
