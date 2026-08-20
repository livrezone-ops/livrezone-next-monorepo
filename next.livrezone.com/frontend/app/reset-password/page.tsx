'use client'
import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../hooks/useAuth';

export default function ResetPasswordPage() {
    const { resetPassword } = useAuth();

    const [token, setToken] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        setToken(params.get('token') ?? '');
        setEmail(params.get('email') ?? '');
    }, []);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError('');
        setMessage('');
        setPending(true);

        try {
            await resetPassword(token, email, password, passwordConfirmation);
            setMessage('Mot de passe réinitialisé. Tu peux te connecter.');
            setPassword('');
            setPasswordConfirmation('');
        } catch (err: any) {
            setError(
                err?.response?.data?.message ||
                    'Échec de la réinitialisation.',
            );
        } finally {
            setPending(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-xl">
                <div className="text-center">
                    <h1 className="text-2xl font-extrabold text-gray-900">
                        Nouveau mot de passe
                    </h1>
                    <p className="mt-2 text-sm text-gray-600">
                        Choisis un nouveau mot de passe pour ton compte
                        LivreZone.
                    </p>
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

                <form onSubmit={handleSubmit} className="space-y-4">
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
                            Nouveau mot de passe
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
                        disabled={pending || !token}
                        className="w-full rounded-lg bg-violet-700 px-6 py-3 font-medium text-white transition hover:bg-violet-800 disabled:opacity-60"
                    >
                        {pending ? 'Enregistrement...' : 'Réinitialiser'}
                    </button>
                </form>

                <div className="text-center">
                    <Link
                        href="/login"
                        className="text-sm font-medium text-violet-700 hover:underline"
                    >
                        Retour à la connexion
                    </Link>
                </div>
            </div>
        </div>
    );
}
