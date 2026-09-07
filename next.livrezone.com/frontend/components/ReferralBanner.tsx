'use client'

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Gift, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const PROMPT_KEY = 'livrezone.referralPrompt';

/**
 * Incitation parrainage affichée juste après chaque connexion (le flag
 * `livrezone.referralPrompt` est posé en sessionStorage à chaque login /
 * consentement provider — sessionStorage = une fois par onglet de session,
 * donc réapparaît à chaque nouvelle connexion). Dismissible.
 */
export default function ReferralBanner() {
    const { isAuthenticated } = useAuth();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (isAuthenticated) {
            try {
                setVisible(sessionStorage.getItem(PROMPT_KEY) === '1');
            } catch {
                setVisible(false);
            }
        } else {
            setVisible(false);
        }
    }, [isAuthenticated]);

    if (!visible) return null;

    const dismiss = () => {
        try {
            sessionStorage.removeItem(PROMPT_KEY);
        } catch {}
        setVisible(false);
    };

    return (
        <div className="relative bg-gradient-to-r from-[#1a0a40] via-[#6D28D9] to-[#1a0a40] text-white">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-center gap-3 px-3 sm:px-6 py-2.5 text-xs sm:text-sm">
                <Gift className="h-4 w-4 shrink-0 text-[#F97316]" />
                <p className="font-semibold truncate">
                    <span className="font-black">Parrainez vos amis :</span> chaque inscription
                    validée = récompense, jusqu&apos;à 3 mois de compte Pro et des livres offerts.
                </p>
                <Link
                    href="/referral"
                    className="shrink-0 rounded-lg bg-[#F97316] hover:bg-[#ea630a] px-3 py-1.5 font-bold transition-colors active:scale-[0.98]"
                >
                    Je découvre
                </Link>
                <button
                    onClick={dismiss}
                    aria-label="Fermer"
                    className="shrink-0 text-white/60 hover:text-white p-1"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
