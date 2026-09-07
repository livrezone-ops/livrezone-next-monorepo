'use client'

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { trackReferralVisit } from '@/lib/referral-api';

const REF_CODE_KEY = 'livrezone.refCode';

/**
 * Tracking parrainage : si l'URL porte ?ref=CODE (landing partagée par un
 * parrain), on appelle l'API pour poser le cookie d'attribution et compter la
 * visite, puis on nettoie l'URL. Le code est aussi gardé en localStorage comme
 * repli envoyé à l'inscription (registerUser → ref_code) au cas où le cookie
 * n'aurait pas survécu.
 */
export default function ReferralTracker() {
    const pathname = usePathname();

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        const raw = params.get('ref');
        if (!raw) return;

        const code = raw.trim().toUpperCase();
        if (!code || code.length > 12) return;

        try {
            localStorage.setItem(REF_CODE_KEY, code);
        } catch {}

        // Fire and forget : jamais de blocage de la navigation pour le tracking.
        trackReferralVisit(code, pathname).catch(() => {});

        // URL propre : ?ref= ne doit pas rester (partages, canonique, refresh).
        params.delete('ref');
        const query = params.toString();
        window.history.replaceState(
            null,
            '',
            window.location.pathname + (query ? `?${query}` : ''),
        );
    }, [pathname]);

    return null;
}
