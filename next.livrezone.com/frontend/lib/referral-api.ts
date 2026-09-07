import api from './axios';

const API_ROOT = (
    process.env.NEXT_PUBLIC_API_URL || 'https://api-next.livrezone.com/api'
).replace(/\/api$/, '');

export interface ReferralProgress {
    current: number;
    target: number;
    percent: number;
    remaining: number;
}

export interface ReferralRewardView {
    id: number;
    name: string;
    description: string | null;
    condition_label: string;
    condition_type: 'signups' | 'visits';
    threshold_value: number;
    reward_type: string;
    reward_label: string;
    repeatable: boolean;
    progress: ReferralProgress;
    unlocked: boolean;
}

export interface ReferralGrantView {
    id: number;
    reward_name: string | null;
    reward_label: string | null;
    reward_type?: string | null;
    status: 'granted' | 'delivered' | 'cancelled';
    granted_at: string | null;
    delivered_at: string | null;
    delivery: Record<string, unknown> | null;
}

export interface ReferralOverview {
    referral_code: string;
    referral_link: string;
    enabled: boolean;
    stats: {
        shares: number;
        signups: number;
        rewards_count: number;
    };
    rewards: ReferralRewardView[];
    grants: ReferralGrantView[];
}

/** Espace parrainage de l'utilisateur connecté (lien, compteurs, paliers, récompenses). */
export async function fetchReferralOverview(): Promise<ReferralOverview> {
    const { data } = await api.get('/referral/me');
    return data;
}

/** Pose le cookie d'attribution + compte la visite (appel public, sans auth). */
export async function trackReferralVisit(code: string, path?: string): Promise<void> {
    await api.post(
        `${API_ROOT}/referral/track`,
        { code, path },
        { baseURL: '' },
    );
}

/** Adresse de livraison d'une récompense physique (livre, cadeau). */
export async function claimReferralGrant(
    grantId: number,
    payload: { full_name: string; phone: string; address: string; city: string },
): Promise<void> {
    await api.post(`/referral/grants/${grantId}/claim`, payload);
}
