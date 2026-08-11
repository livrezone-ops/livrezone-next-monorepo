'use client'
import { useAuth } from '../../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/axios';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardPage() {
    const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [isAuthenticated, authLoading, router]);

    const { data: dashboardData, isLoading: dataLoading } = useQuery({
        queryKey: ['dashboard-listings'],
        queryFn: async () => {
            const { data } = await api.get('/dashboard/listings');
            return data;
        },
        enabled: isAuthenticated,
    });

    if (authLoading || dataLoading) {
        return <div className="flex h-screen items-center justify-center">Chargement de votre espace...</div>;
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="mx-auto max-w-7xl">
                <div className="mb-8 flex items-center justify-between rounded-xl bg-white p-6 shadow">
                    <div className="flex items-center gap-4">
                        <img 
                            src={user.profile.logo} 
                            alt="Logo Profil" 
                            className="h-16 w-16 rounded-full object-cover shadow-sm"
                        />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Bienvenue, {user.profile.nickname}</h1>
                            <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                    </div>
                    <button 
                        onClick={logout}
                        className="rounded bg-red-500 px-4 py-2 font-semibold text-white hover:bg-red-600"
                    >
                        Déconnexion
                    </button>
                </div>

                <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div className="rounded-xl bg-white p-6 shadow border-l-4 border-blue-500">
                        <p className="text-sm text-gray-500">Annonces Actives</p>
                        <p className="text-3xl font-bold text-gray-800">{dashboardData?.meta.active_count || 0}</p>
                    </div>
                    <div className="rounded-xl bg-white p-6 shadow border-l-4 border-green-500">
                        <p className="text-sm text-gray-500">Annonces Vendues</p>
                        <p className="text-3xl font-bold text-gray-800">{dashboardData?.meta.sold_count || 0}</p>
                    </div>
                </div>

                <div className="rounded-xl bg-white p-6 shadow">
                    <h2 className="mb-4 text-xl font-semibold">Vos annonces ({dashboardData?.meta.total || 0})</h2>
                    {(!dashboardData?.data || dashboardData.data.length === 0) ? (
                        <p className="text-gray-500">Vous n'avez aucune annonce pour le moment.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-500">
                                <thead className="bg-gray-50 text-xs uppercase text-gray-700">
                                    <tr>
                                        <th className="px-6 py-3">Titre</th>
                                        <th className="px-6 py-3">Prix</th>
                                        <th className="px-6 py-3">Statut</th>
                                        <th className="px-6 py-3">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dashboardData.data.map((listing: any) => (
                                        <tr key={listing.id} className="border-b bg-white">
                                            <td className="px-6 py-4 font-medium text-gray-900">{listing.title}</td>
                                            <td className="px-6 py-4">{listing.price} MAD</td>
                                            <td className="px-6 py-4">
                                                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${listing.status === 'sold' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                                    {listing.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button className="text-blue-600 hover:underline">Modifier</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
