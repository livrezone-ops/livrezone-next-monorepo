'use client'
import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import {
    rememberNextPath,
    consumePendingPath,
    safeNextPath,
} from '../../lib/auth-redirect';

type Tab = 'login' | 'register' | 'forgot';

export default function LoginPage() {
    const {
        isAuthenticated,
        isLoading,
        loginWithProvider,
        loginWithCredentials,
        registerUser,
        forgotPassword,
    } = useAuth();
    const router = useRouter();

    const [tab, setTab] = useState<Tab>('login');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');

    useEffect(() => {
        const nextParam = new URLSearchParams(window.location.search).get('next');
        const next = safeNextPath(nextParam);
        if (next) rememberNextPath(next);
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            const destination = safeNextPath(consumePendingPath()) || '/dashboard';
            router.replace(destination);
        }
    }, [isAuthenticated, router]);

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                Chargement...
            </div>
        );
    }

    const switchTab = (next: Tab) => {
        setTab(next);
        setError('');
        setMessage('');
    };

    const handleLogin = async (event: FormEvent) => {
        event.preventDefault();
        setError('');
        setMessage('');
        setPending(true);

        try {
            await loginWithCredentials(email, password);
        } catch (err: any) {
            setError(
                err?.response?.data?.message ||
                    'Identifiants invalides.',
            );
        } finally {
            setPending(false);
        }
    };

    const handleRegister = async (event: FormEvent) => {
        event.preventDefault();
        setError('');
        setMessage('');
        setPending(true);

        try {
            await registerUser(name, email, password, passwordConfirmation);
            setMessage(
                'Compte créé. Vérifie ta boîte email pour confirmer ton adresse, puis connecte-toi.',
            );
            setName('');
            setEmail('');
            setPassword('');
            setPasswordConfirmation('');
        } catch (err: any) {
            setError(
                err?.response?.data?.message ||
                    'Impossible de créer le compte.',
            );
        } finally {
            setPending(false);
        }
    };

    const handleForgot = async (event: FormEvent) => {
        event.preventDefault();
        setError('');
        setMessage('');
        setPending(true);

        try {
            await forgotPassword(email);
            setMessage(
                'Si un compte existe, un lien de réinitialisation a été envoyé.',
            );
        } catch {
            setError('Une erreur est survenue. Réessaie plus tard.');
        } finally {
            setPending(false);
        }
    };

    const tabClass = (value: Tab) =>
        `flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === value
                ? 'bg-violet-700 text-white shadow'
                : 'text-gray-500 hover:text-violet-700'
        }`;

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-xl">
                <div className="text-center">
                    <h1 className="text-3xl font-extrabold text-gray-900">
                        LivreZone
                    </h1>
                    <p className="mt-2 text-sm text-gray-600">
                        Achète et vends des livres entre passionnés.
                    </p>
                </div>

                {/* Connexion sociale 1 clic */}
                <div className="space-y-3">
                    <button
                        onClick={() => loginWithProvider('google')}
                        className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                        <span className="text-base font-semibold text-violet-700">
                            G
                        </span>
                        Continuer avec Google
                    </button>
                    <button
                        onClick={() => loginWithProvider('facebook')}
                        className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                        <span className="text-base font-semibold text-blue-600">
                            f
                        </span>
                        Continuer avec Facebook
                    </button>
                </div>

                <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="h-px flex-1 bg-gray-200" />
                    ou avec ton email
                    <span className="h-px flex-1 bg-gray-200" />
                </div>

                {/* Onglets */}
                <div className="flex gap-2 rounded-xl bg-gray-100 p-1">
                    <button
                        className={tabClass('login')}
                        onClick={() => switchTab('login')}
                        type="button"
                    >
                        Connexion
                    </button>
                    <button
                        className={tabClass('register')}
                        onClick={() => switchTab('register')}
                        type="button"
                    >
                        Inscription
                    </button>
                    <button
                        className={tabClass('forgot')}
                        onClick={() => switchTab('forgot')}
                        type="button"
                    >
                        Mot de passe
                    </button>
                </div>

                {error && (
                    <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {message && (
                    <div className="rounded-lg bg-violet-50 px-4 py-3 text-sm text-violet-800">
                        {message}
                    </div>
                )}

                {tab === 'login' && (
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Email
                            </label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                                placeholder="ton@email.com"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Mot de passe
                            </label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                                placeholder="••••••••"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={pending}
                            className="w-full rounded-lg bg-violet-700 px-6 py-3 font-medium text-white transition hover:bg-violet-800 disabled:opacity-60"
                        >
                            {pending ? 'Connexion...' : 'Se connecter'}
                        </button>
                    </form>
                )}

                {tab === 'register' && (
                    <form onSubmit={handleRegister} className="space-y-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Nom complet
                            </label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                                placeholder="Ton nom"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Email
                            </label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                                placeholder="ton@email.com"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Mot de passe
                            </label>
                            <input
                                type="password"
                                required
                                minLength={8}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                                placeholder="Minimum 8 caractères"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Confirmer le mot de passe
                            </label>
                            <input
                                type="password"
                                required
                                minLength={8}
                                value={passwordConfirmation}
                                onChange={(e) =>
                                    setPasswordConfirmation(e.target.value)
                                }
                                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                                placeholder="••••••••"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={pending}
                            className="w-full rounded-lg bg-violet-700 px-6 py-3 font-medium text-white transition hover:bg-violet-800 disabled:opacity-60"
                        >
                            {pending ? 'Création...' : "S'inscrire"}
                        </button>
                    </form>
                )}

                {tab === 'forgot' && (
                    <form onSubmit={handleForgot} className="space-y-4">
                        <p className="text-sm text-gray-600">
                            Saisis ton email pour recevoir un lien de
                            réinitialisation.
                        </p>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Email
                            </label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                                placeholder="ton@email.com"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={pending}
                            className="w-full rounded-lg bg-violet-700 px-6 py-3 font-medium text-white transition hover:bg-violet-800 disabled:opacity-60"
                        >
                            {pending ? 'Envoi...' : 'Envoyer le lien'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
