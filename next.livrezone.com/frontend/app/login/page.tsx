'use client'
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LoginPage() {
    const { isAuthenticated, isLoading, loginWithProvider } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (isAuthenticated) {
            router.push('/dashboard');
        }
    }, [isAuthenticated, router]);

    if (isLoading) return <div className="flex h-screen items-center justify-center">Chargement...</div>;

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
            <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-10 shadow-lg">
                <div className="text-center">
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                        Connexion LivreZone
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Veuillez vous connecter pour accéder à votre espace
                    </p>
                </div>
                
                <div className="mt-8 space-y-6">
                    <button
                        onClick={() => loginWithProvider('google')}
                        className="group relative flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        Continuer avec Google
                    </button>
                    <button
                        onClick={() => loginWithProvider('facebook')}
                        className="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        Continuer avec Facebook
                    </button>
                </div>
            </div>
        </div>
    );
}
