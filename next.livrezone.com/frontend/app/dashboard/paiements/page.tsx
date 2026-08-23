"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/axios";
import { Loader2, CreditCard, Receipt } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PaiementsPage() {
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
            return;
        }

        if (isAuthenticated) {
            fetchPayments();
        }
    }, [isAuthenticated, authLoading]);

    const fetchPayments = async () => {
        try {
            const { data } = await api.get('/payments');
            setPayments(data.payments || []);
        } catch (error) {
            console.error("Erreur lors de la récupération des paiements:", error);
        } finally {
            setLoading(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="animate-spin h-8 w-8 text-violet-600" />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <CreditCard className="w-6 h-6 text-[#6D28D9]" /> Historique des paiements
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Consultez l'historique de vos abonnements et factures.</p>
                </div>
                <Link href="/tarification" className="px-4 py-2 bg-[#6D28D9] text-white rounded-lg font-bold text-sm hover:bg-violet-800 transition-colors shadow-sm">
                    Voir les offres
                </Link>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase font-bold text-gray-700">
                            <tr>
                                <th className="px-6 py-4">Date de paiement</th>
                                <th className="px-6 py-4">Service (Offre)</th>
                                <th className="px-6 py-4">Montant</th>
                                <th className="px-6 py-4">Date d'expiration</th>
                                <th className="px-6 py-4">Statut</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {payments.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <Receipt className="w-12 h-12 text-gray-300 mb-3" />
                                            <p className="text-base font-bold text-gray-700">Vous n'avez aucun paiement.</p>
                                            <p className="text-xs text-gray-400 mt-1">Les abonnements Pro et Premium s'afficheront ici.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                payments.map((payment) => (
                                    <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            {payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('fr-FR') : '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex px-2 py-1 rounded text-xs font-bold uppercase ${
                                                payment.subscription_type === 'premium' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                                            }`}>
                                                {payment.subscription_type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-gray-900">
                                            {payment.amount} MAD
                                        </td>
                                        <td className="px-6 py-4">
                                            {payment.expires_at ? new Date(payment.expires_at).toLocaleDateString('fr-FR') : '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            {payment.status === 'paid' && <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-full text-[11px]">Payé</span>}
                                            {payment.status === 'pending' && <span className="text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-full text-[11px]">En attente</span>}
                                            {payment.status === 'failed' && <span className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded-full text-[11px]">Échoué</span>}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
