'use client';

import { useCallback, useState } from 'react';

/**
 * Consentement CGV — socle unique pour tous les parcours de création de compte
 * (inscription standard, connexion/inscription via Google, Facebook ou tout
 * autre provider Socialite).
 *
 * Règle : tout point d'entrée d'authentification susceptible de CRÉER un compte
 * doit appeler `ensureAccepted()` avant de déclencher la redirection provider
 * ou l'inscription. Si le consentement manque, `rejected` passe à true (à
 * afficher par l'écran consommateur) et la fonction retourne false.
 *
 * Écrans consommateurs : app/login/page.tsx, components/SaveCartModal.tsx.
 */
export function useCgvConsent() {
    const [accepted, setAccepted] = useState(false);
    const [rejected, setRejected] = useState(false);

    const accept = useCallback((value: boolean) => {
        setAccepted(value);
        if (value) {
            setRejected(false);
        }
    }, []);

    const ensureAccepted = useCallback((): boolean => {
        if (accepted) {
            return true;
        }
        setRejected(true);
        return false;
    }, [accepted]);

    return { accepted, accept, rejected, ensureAccepted };
}
