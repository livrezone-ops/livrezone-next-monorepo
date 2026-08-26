'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
    rememberNextPath,
    consumePendingPath,
    safeNextPath,
} from '../../lib/auth-redirect';
import { getApiErrorMessage } from '../../lib/api-error';
import {
    BookOpen,
    LogIn,
    UserPlus,
    KeyRound,
    Mail,
    Lock,
    User as UserIcon,
    Eye,
    EyeOff,
    AlertTriangle,
    CheckCircle2,
    MailCheck,
    Loader2,
    ArrowLeft,
    RefreshCw,
} from 'lucide-react';
import Logo from '@/components/Logo';

type Tab = 'login' | 'register' | 'forgot';

// Facebook login masqué pour le moment (à paramétrer plus tard)
const SHOW_FACEBOOK = false;

function LoginForm() {
    const {
        isAuthenticated,
        isLoading,
        loginWithProvider,
        loginWithCredentials,
        registerUser,
        resendVerification,
        forgotPassword,
    } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [tab, setTab] = useState<Tab>('login');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);
    const [registered, setRegistered] = useState(false);
    const [registeredEmail, setRegisteredEmail] = useState('');
    const [resendMsg, setResendMsg] = useState('');
    const [resendSuccess, setResendSuccess] = useState(false);

    // Password visibility toggles
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

    // Form states
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');

    const verified = searchParams.get('verified') === '1';

    useEffect(() => {
        const nextParam = searchParams.get('next');
        const next = safeNextPath(nextParam);
        if (next) rememberNextPath(next);
    }, [searchParams]);

    useEffect(() => {
        if (isAuthenticated) {
            const destination = safeNextPath(consumePendingPath()) || '/dashboard';
            router.replace(destination);
        }
    }, [isAuthenticated, router]);

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="flex items-center gap-3 text-slate-600">
                    <Loader2 className="h-6 w-6 animate-spin text-[#6D28D9]" />
                    <span className="text-sm font-medium">Chargement...</span>
                </div>
            </div>
        );
    }

    const switchTab = (next: Tab) => {
        setTab(next);
        setError('');
        setMessage('');
        setResendMsg('');
    };

    const isEmailValid = (value: string) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

    const handleLogin = async (event: FormEvent) => {
        event.preventDefault();

        if (!isEmailValid(email)) {
            setError('Veuillez saisir une adresse email valide.');
            return;
        }

        setError('');
        setMessage('');
        setPending(true);

        try {
            await loginWithCredentials(email, password);
        } catch (err) {
            setError(
                getApiErrorMessage(
                    err,
                    'Identifiants invalides. Vérifiez votre email et mot de passe.',
                ),
            );
        } finally {
            setPending(false);
        }
    };

    const handleRegister = async (event: FormEvent) => {
        event.preventDefault();

        if (name.trim().length < 3) {
            setError('Le nom doit contenir au moins 3 caractères.');
            return;
        }

        if (!isEmailValid(email)) {
            setError('Veuillez saisir une adresse email valide.');
            return;
        }

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
            await registerUser(name, email, password, passwordConfirmation);
            setRegistered(true);
            setRegisteredEmail(email);
            setName('');
            setPassword('');
            setPasswordConfirmation('');
        } catch (err) {
            setError(
                getApiErrorMessage(
                    err,
                    'Impossible de créer le compte. Vérifiez les informations saisies.',
                ),
            );
        } finally {
            setPending(false);
        }
    };

    const handleForgot = async (event: FormEvent) => {
        event.preventDefault();

        if (!isEmailValid(email)) {
            setError('Veuillez saisir une adresse email valide.');
            return;
        }

        setError('');
        setMessage('');
        setPending(true);

        try {
            await forgotPassword(email);
            setMessage(
                'Si un compte existe avec cet email, un lien de réinitialisation vous a été envoyé. Pensez à vérifier vos courriers indésirables (spams).',
            );
        } catch {
            setError('Une erreur est survenue. Veuillez réessayer plus tard.');
        } finally {
            setPending(false);
        }
    };

    const handleResend = async () => {
        setResendMsg('');
        setResendSuccess(false);
        setPending(true);

        try {
            await resendVerification(registeredEmail || email);
            setResendSuccess(true);
            setResendMsg('Un nouvel email de confirmation a été envoyé. Pensez à vérifier vos spams.');
        } catch {
            setResendSuccess(false);
            setResendMsg('Impossible de renvoyer l’email pour le moment.');
        } finally {
            setPending(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-start bg-gradient-to-b from-slate-50 via-slate-50 to-purple-50/20 px-4 pt-5 pb-12 sm:pt-7 sm:pb-16">
            <div className="w-full max-w-[680px]">
                
                {/* Carte principale allongée (+20% plus longue et entièrement visible sans défilement) */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 md:p-9 shadow-xl shadow-slate-100/80">
                    
                    {/* Header Logo + Titre */}
                    <div className="mb-5 text-center">
                        <div className="flex justify-center">
                            <Logo size="lg" href="/" />
                        </div>
                        <p className="mt-2 text-xs sm:text-sm text-slate-500 font-medium">
                            La plateforme d’achat et vente de livres d’occasion
                        </p>
                    </div>

                    {/* Notification Email Vérifié */}
                    {verified && (
                        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs sm:text-sm text-emerald-800 shadow-2xs">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                            <div>
                                <span className="font-semibold">Email vérifié avec succès !</span>
                                <p className="text-emerald-700 mt-0.5">Vous pouvez maintenant vous connecter à votre compte.</p>
                            </div>
                        </div>
                    )}

                    {/* Bouton Google Pro (1-Click) */}
                    <div className="mb-4">
                        <button
                            type="button"
                            onClick={() => loginWithProvider('google')}
                            className="group relative flex w-full h-11 sm:h-12 items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-[0.99]"
                        >
                            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                                <path
                                    fill="#4285F4"
                                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                                />
                                <path
                                    fill="#EA4335"
                                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                                />
                            </svg>
                            <span>Continuer avec Google</span>
                        </button>

                        {SHOW_FACEBOOK && (
                            <button
                                type="button"
                                onClick={() => loginWithProvider('facebook')}
                                className="mt-2.5 flex w-full h-11 sm:h-12 items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-[0.99]"
                            >
                                <span className="text-sm font-bold text-[#1877F2]">f</span>
                                <span>Continuer avec Facebook</span>
                            </button>
                        )}
                    </div>

                    {/* Séparateur élégant */}
                    <div className="relative mb-4 flex items-center justify-center">
                        <div className="w-full border-t border-slate-200" />
                        <span className="absolute bg-white px-4 text-xs font-medium uppercase tracking-wider text-slate-400">
                            ou par email
                        </span>
                    </div>

                    {/* Navigation par Onglets Segments (Pills) */}
                    <div className="mb-5 flex rounded-xl bg-slate-100 p-1 border border-slate-200/50">
                        <button
                            type="button"
                            onClick={() => switchTab('login')}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs sm:text-sm font-semibold transition-all ${
                                tab === 'login'
                                    ? 'bg-white text-[#6D28D9] shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <LogIn className="h-4 w-4" />
                            Connexion
                        </button>
                        <button
                            type="button"
                            onClick={() => switchTab('register')}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs sm:text-sm font-semibold transition-all ${
                                tab === 'register'
                                    ? 'bg-white text-[#6D28D9] shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <UserPlus className="h-4 w-4" />
                            Inscription
                        </button>
                        <button
                            type="button"
                            onClick={() => switchTab('forgot')}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs sm:text-sm font-semibold transition-all ${
                                tab === 'forgot'
                                    ? 'bg-white text-[#6D28D9] shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <KeyRound className="h-4 w-4" />
                            Oubli ?
                        </button>
                    </div>

                    {/* Message d'Erreur (Style Dashboard) */}
                    {error && (
                        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-xs text-rose-700 shadow-2xs">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                            <div className="flex-1 font-medium">{error}</div>
                        </div>
                    )}

                    {/* Message d'Information / Succès (Style Dashboard) */}
                    {message && (
                        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-violet-200 bg-violet-50/90 p-3 text-xs text-violet-800 shadow-2xs">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#6D28D9] mt-0.5" />
                            <div className="flex-1 font-medium">{message}</div>
                        </div>
                    )}

                    {/* Écran Spécial : Inscription réussie - En attente de validation email */}
                    {registered && tab === 'register' ? (
                        <div className="space-y-4 py-2">
                            <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 text-center">
                                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-[#6D28D9]">
                                    <MailCheck className="h-5 w-5" />
                                </div>
                                <h3 className="text-sm font-bold text-slate-900">
                                    Vérifiez votre boîte email
                                </h3>
                                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                                    Un lien de confirmation a été envoyé à <strong className="text-slate-900 font-semibold">{registeredEmail}</strong>.
                                </p>
                                <div className="mt-3 rounded-lg bg-amber-50/80 border border-amber-200/70 p-2.5 text-[11px] text-amber-800 text-left">
                                    <span className="font-bold">⚠️ Conseil :</span> Si vous ne trouvez pas l’email dans quelques instants, vérifiez votre dossier <strong>Spams</strong> ou <strong>Courrier indésirable</strong>.
                                </div>
                            </div>

                            {resendMsg && (
                                <div className={`rounded-lg p-2.5 text-xs text-center font-medium ${resendSuccess ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                                    {resendMsg}
                                </div>
                            )}

                            <div className="flex flex-col gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={handleResend}
                                    disabled={pending}
                                    className="flex w-full h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-60"
                                >
                                    {pending ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
                                    ) : (
                                        <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                                    )}
                                    Renvoyer l’email de confirmation
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setRegistered(false);
                                        switchTab('login');
                                    }}
                                    className="w-full h-10 rounded-xl bg-[#6D28D9] text-xs font-semibold text-white hover:bg-[#5b21b6] transition-all shadow-xs"
                                >
                                    Aller à la connexion
                                </button>
                            </div>
                        </div>
                    ) : null}

                    {/* FORMULAIRE : CONNEXION */}
                    {tab === 'login' && (
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div>
                                <label className="mb-1.5 block text-xs sm:text-sm font-semibold text-slate-700">
                                    Email
                                </label>
                                <div className="relative">
                                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="h-11 sm:h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-11 pr-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#6D28D9] focus:bg-white focus:ring-2 focus:ring-[#6D28D9]/20"
                                        placeholder="votre@email.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="mb-1.5 flex items-center justify-between">
                                    <label className="text-xs sm:text-sm font-semibold text-slate-700">
                                        Mot de passe
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => switchTab('forgot')}
                                        className="text-xs font-semibold text-[#6D28D9] hover:underline"
                                    >
                                        Mot de passe oublié ?
                                    </button>
                                </div>
                                <div className="relative">
                                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="h-11 sm:h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-11 pr-11 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#6D28D9] focus:bg-white focus:ring-2 focus:ring-[#6D28D9]/20"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
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

                            <button
                                type="submit"
                                disabled={pending}
                                className="mt-2 flex w-full h-12 items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-5 text-sm font-semibold text-white shadow-xs transition-all hover:bg-[#5b21b6] hover:shadow-md hover:shadow-purple-500/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {pending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Connexion en cours...</span>
                                    </>
                                ) : (
                                    <>
                                        <LogIn className="h-4 w-4" />
                                        <span>Se connecter</span>
                                    </>
                                )}
                            </button>
                        </form>
                    )}

                    {/* FORMULAIRE : INSCRIPTION */}
                    {tab === 'register' && !registered && (
                        <form onSubmit={handleRegister} className="space-y-3.5">
                            <div>
                                <label className="mb-1.5 block text-xs sm:text-sm font-semibold text-slate-700">
                                    Nom complet ou pseudo
                                </label>
                                <div className="relative">
                                    <UserIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        required
                                        minLength={3}
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="h-11 sm:h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-11 pr-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#6D28D9] focus:bg-white focus:ring-2 focus:ring-[#6D28D9]/20"
                                        placeholder="Ex: Fertilane"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-1.5 block text-xs sm:text-sm font-semibold text-slate-700">
                                    Email
                                </label>
                                <div className="relative">
                                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="h-11 sm:h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-11 pr-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#6D28D9] focus:bg-white focus:ring-2 focus:ring-[#6D28D9]/20"
                                        placeholder="votre@email.com"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1.5 block text-xs sm:text-sm font-semibold text-slate-700">
                                        Mot de passe
                                    </label>
                                    <div className="relative">
                                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            minLength={8}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="h-11 sm:h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-9 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#6D28D9] focus:bg-white focus:ring-2 focus:ring-[#6D28D9]/20"
                                            placeholder="8+ caractères"
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
                                    <label className="mb-1.5 block text-xs sm:text-sm font-semibold text-slate-700">
                                        Confirmation
                                    </label>
                                    <div className="relative">
                                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type={showPasswordConfirm ? 'text' : 'password'}
                                            required
                                            minLength={8}
                                            value={passwordConfirmation}
                                            onChange={(e) => setPasswordConfirmation(e.target.value)}
                                            className="h-11 sm:h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-9 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#6D28D9] focus:bg-white focus:ring-2 focus:ring-[#6D28D9]/20"
                                            placeholder="Répéter mot de passe"
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
                            </div>

                            <button
                                type="submit"
                                disabled={pending}
                                className="mt-2 flex w-full h-12 items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-5 text-sm font-semibold text-white shadow-xs transition-all hover:bg-[#5b21b6] hover:shadow-md hover:shadow-purple-500/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {pending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Création du compte...</span>
                                    </>
                                ) : (
                                    <>
                                        <UserPlus className="h-4 w-4" />
                                        <span>Créer mon compte</span>
                                    </>
                                )}
                            </button>
                        </form>
                    )}

                    {/* FORMULAIRE : MOT DE PASSE OUBLIÉ */}
                    {tab === 'forgot' && (
                        <form onSubmit={handleForgot} className="space-y-4">
                            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                                Entrez votre adresse email pour recevoir un lien sécurisé de réinitialisation.
                            </p>
                            <div>
                                <label className="mb-1.5 block text-xs sm:text-sm font-semibold text-slate-700">
                                    Email
                                </label>
                                <div className="relative">
                                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="h-11 sm:h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-11 pr-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#6D28D9] focus:bg-white focus:ring-2 focus:ring-[#6D28D9]/20"
                                        placeholder="votre@email.com"
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={pending}
                                className="mt-2 flex w-full h-12 items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-5 text-sm font-semibold text-white shadow-xs transition-all hover:bg-[#5b21b6] hover:shadow-md hover:shadow-purple-500/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {pending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Envoi en cours...</span>
                                    </>
                                ) : (
                                    <>
                                        <KeyRound className="h-4 w-4" />
                                        <span>Envoyer le lien de réinitialisation</span>
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => switchTab('login')}
                                className="mt-2.5 flex w-full items-center justify-center gap-2 text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Retour à la connexion
                            </button>
                        </form>
                    )}

                    {/* Footer légal compact */}
                    <p className="mt-5 text-center text-[11px] text-slate-400 leading-tight">
                        En continuant, vous acceptez nos{' '}
                        <Link href="/cgv" className="text-slate-500 hover:underline">
                            Conditions Générales
                        </Link>{' '}
                        et notre{' '}
                        <Link href="/confidentialite" className="text-slate-500 hover:underline">
                            Politique de confidentialité
                        </Link>
                        .
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-slate-50">
                    <div className="flex items-center gap-3 text-slate-600">
                        <Loader2 className="h-6 w-6 animate-spin text-[#6D28D9]" />
                        <span className="text-sm font-medium">Chargement...</span>
                    </div>
                </div>
            }
        >
            <LoginForm />
        </Suspense>
    );
}
