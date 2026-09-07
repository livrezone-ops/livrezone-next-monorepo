'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
    Gift, Copy, Check, Eye, Users, Trophy, Loader2, Share2,
    Clock, Package, Ban, BadgeCheck,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
    claimReferralGrant,
    fetchReferralOverview,
    type ReferralGrantView,
} from '@/lib/referral-api';
import { getApiErrorMessage } from '@/lib/api-error';

const SHARE_TEXT =
    'Découvre LivreZone, la marketplace de livres neufs et d\'occasion au Maroc !';

const GRANT_STATUS: Record<string, { label: string; className: string }> = {
    granted: {
        label: 'Créditée',
        className: 'bg-violet-100 text-[#6D28D9]',
    },
    delivered: {
        label: 'Livrée',
        className: 'bg-emerald-100 text-emerald-700',
    },
    cancelled: {
        label: 'Annulée',
        className: 'bg-red-100 text-red-600',
    },
};

function GrantStatusIcon({ status }: { status: string }) {
    if (status === 'delivered') return <Package className="h-4 w-4" />;
    if (status === 'cancelled') return <Ban className="h-4 w-4" />;
    return <Clock className="h-4 w-4" />;
}

export default function ReferralSpace() {
    const router = useRouter();
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const [copied, setCopied] = useState(false);
    const [claimGrantId, setClaimGrantId] = useState<number | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['referral', 'me'],
        queryFn: fetchReferralOverview,
        enabled: isAuthenticated,
        retry: false,
    });

    // Page réservée aux connectés : renvoi vers /login (retour automatique
    // après connexion via le next).
    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.replace('/login?next=/referral');
        }
    }, [authLoading, isAuthenticated, router]);

    if (authLoading || !isAuthenticated) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-[#6D28D9]" />
            </div>
        );
    }

    const copyLink = async () => {
        if (!data?.referral_link) return;
        try {
            await navigator.clipboard.writeText(data.referral_link);
        } catch {
            const input = document.createElement('input');
            input.value = data.referral_link;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const openClaim = (grant: ReferralGrantView) => setClaimGrantId(grant.id);

    return (
        <div className="mx-auto w-full max-w-5xl px-3 sm:px-6 py-8">
            {/* En-tête */}
            <div className="flex items-center gap-3 mb-2">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#6D28D9] text-white shadow-sm">
                    <Gift className="h-6 w-6" />
                </span>
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">
                        Parrainage
                    </h1>
                    <p className="text-sm text-gray-500">
                        Invitez vos amis, gagnez des récompenses quand ils s&apos;inscrivent.
                    </p>
                </div>
            </div>

            {data && !data.enabled && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Le programme est actuellement en pause. Vos compteurs et
                    récompenses existantes sont conservés.
                </div>
            )}

            {/* Lien de parrainage */}
            <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-5 sm:p-6 shadow-xs">
                <p className="text-sm font-bold text-gray-900 mb-1">Votre lien de parrainage</p>
                <p className="text-xs text-gray-500 mb-4">
                    Partagez-le : chaque inscription validée via ce lien vous rapproche du prochain palier.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        readOnly
                        value={data?.referral_link ?? ''}
                        className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 focus:outline-none"
                        onFocus={(e) => e.target.select()}
                    />
                    <button
                        onClick={copyLink}
                        className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-white transition-colors ${
                            copied ? 'bg-emerald-600' : 'bg-[#6D28D9] hover:bg-violet-800'
                        }`}
                    >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? 'Copié !' : 'Copier le lien'}
                    </button>
                </div>

                {data?.referral_link && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Share2 className="h-4 w-4 text-gray-400" />
                        <a
                            href={`https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${data.referral_link}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:border-emerald-400 hover:text-emerald-600 transition-colors"
                        >
                            WhatsApp
                        </a>
                        <a
                            href={`https://t.me/share/url?url=${encodeURIComponent(data.referral_link)}&text=${encodeURIComponent(SHARE_TEXT)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:border-sky-400 hover:text-sky-600 transition-colors"
                        >
                            Telegram
                        </a>
                        <a
                            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(data.referral_link)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:border-blue-400 hover:text-blue-600 transition-colors"
                        >
                            Facebook
                        </a>
                        <a
                            href={`mailto:?subject=${encodeURIComponent('LivreZone')}&body=${encodeURIComponent(`${SHARE_TEXT} ${data.referral_link}`)}`}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:border-[#6D28D9] hover:text-[#6D28D9] transition-colors"
                        >
                            Email
                        </a>
                    </div>
                )}
            </div>

            {/* Compteurs */}
            <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-xs">
                    <Eye className="mx-auto h-5 w-5 text-[#6D28D9]" />
                    <p className="mt-1 text-2xl font-black text-gray-900">{data?.stats.shares ?? 0}</p>
                    <p className="text-xs font-semibold text-gray-500">Visites générées</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-xs">
                    <Users className="mx-auto h-5 w-5 text-[#6D28D9]" />
                    <p className="mt-1 text-2xl font-black text-gray-900">{data?.stats.signups ?? 0}</p>
                    <p className="text-xs font-semibold text-gray-500">Inscriptions validées</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-xs">
                    <Trophy className="mx-auto h-5 w-5 text-[#F97316]" />
                    <p className="mt-1 text-2xl font-black text-gray-900">{data?.stats.rewards_count ?? 0}</p>
                    <p className="text-xs font-semibold text-gray-500">Récompenses</p>
                </div>
            </div>

            {/* Paliers */}
            <h2 className="mt-8 text-lg font-black tracking-tight text-gray-900">
                Récompenses à débloquer
            </h2>
            <div className="mt-3 space-y-3">
                {isLoading && (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-[#6D28D9]" />
                    </div>
                )}
                {data?.rewards.map((reward) => (
                    <div
                        key={reward.id}
                        className={`rounded-2xl border bg-white p-4 sm:p-5 shadow-xs ${
                            reward.unlocked ? 'border-emerald-200' : 'border-gray-100'
                        }`}
                    >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                                <p className="font-bold text-gray-900">
                                    {reward.name}
                                    {reward.repeatable && (
                                        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-500">
                                            à chaque palier
                                        </span>
                                    )}
                                </p>
                                {reward.description && (
                                    <p className="text-xs text-gray-500 mt-0.5">{reward.description}</p>
                                )}
                            </div>
                            {reward.unlocked ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                                    <BadgeCheck className="h-3.5 w-3.5" /> Débloqué
                                </span>
                            ) : (
                                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-[#6D28D9]">
                                    Plus que {reward.progress.remaining}
                                </span>
                            )}
                        </div>

                        <div className="mt-3">
                            <div className="flex justify-between text-xs font-semibold text-gray-500 mb-1">
                                <span>{reward.condition_label}</span>
                                <span>
                                    {Math.min(reward.progress.current, reward.progress.target)} / {reward.progress.target}
                                </span>
                            </div>
                            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                                <div
                                    className={`h-full rounded-full transition-all ${
                                        reward.unlocked ? 'bg-emerald-500' : 'bg-[#6D28D9]'
                                    }`}
                                    style={{ width: `${reward.progress.percent}%` }}
                                />
                            </div>
                        </div>

                        <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#F97316]/10 px-3 py-1.5 text-sm font-bold text-[#ea630a]">
                            <Gift className="h-4 w-4" /> {reward.reward_label}
                        </p>
                    </div>
                ))}
            </div>

            {/* Historique */}
            {data && data.grants.length > 0 && (
                <>
                    <h2 className="mt-8 text-lg font-black tracking-tight text-gray-900">
                        Mes récompenses obtenues
                    </h2>
                    <div className="mt-3 space-y-2">
                        {data.grants.map((grant) => {
                            const status = GRANT_STATUS[grant.status] ?? GRANT_STATUS.granted;
                            return (
                                <div
                                    key={grant.id}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-xs"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-gray-900">
                                            {grant.reward_label ?? grant.reward_name}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {grant.granted_at
                                                ? new Date(grant.granted_at).toLocaleDateString('fr-FR', {
                                                      day: 'numeric',
                                                      month: 'long',
                                                      year: 'numeric',
                                                  })
                                                : ''}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span
                                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}
                                        >
                                            <GrantStatusIcon status={grant.status} /> {status.label}
                                        </span>
                                        {grant.status === 'granted'
                                            && (grant.reward_type === 'physical_book' || grant.reward_type === 'gift')
                                            && !grant.delivery?.address && (
                                            <button
                                                onClick={() => openClaim(grant)}
                                                className="rounded-lg bg-[#F97316] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#ea630a] transition-colors"
                                            >
                                                Renseigner mon adresse
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {claimGrantId !== null && (
                <ClaimModal
                    grantId={claimGrantId}
                    onClose={() => setClaimGrantId(null)}
                />
            )}
        </div>
    );
}

/** Adresse de livraison d'une récompense physique (livre, cadeau). */
function ClaimModal({ grantId, onClose }: { grantId: number; onClose: () => void }) {
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({ full_name: '', phone: '', address: '', city: '' });

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setPending(true);
        setError('');
        try {
            await claimReferralGrant(grantId, form);
            onClose();
        } catch (err) {
            setError(getApiErrorMessage(err, "Impossible d'enregistrer l'adresse."));
        } finally {
            setPending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <form
                onSubmit={submit}
                className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            >
                <h3 className="text-lg font-black text-gray-900">Adresse de livraison</h3>
                <p className="mt-1 text-xs text-gray-500">
                    Renseignez vos coordonnées pour recevoir votre récompense.
                </p>
                {(['full_name', 'phone', 'address', 'city'] as const).map((field) => (
                    <input
                        key={field}
                        required
                        value={form[field]}
                        onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                        placeholder={
                            field === 'full_name' ? 'Nom complet'
                            : field === 'phone' ? 'Téléphone'
                            : field === 'address' ? 'Adresse'
                            : 'Ville'
                        }
                        className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#6D28D9] focus:outline-none"
                    />
                ))}
                {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
                <div className="mt-4 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50"
                    >
                        Annuler
                    </button>
                    <button
                        type="submit"
                        disabled={pending}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#6D28D9] px-4 py-2 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-60"
                    >
                        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                        Envoyer
                    </button>
                </div>
            </form>
        </div>
    );
}
