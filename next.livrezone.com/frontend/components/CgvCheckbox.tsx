'use client';

import Link from 'next/link';

type CgvCheckboxProps = {
    /** id unique de la checkbox (relié au label par htmlFor) */
    id: string;
    accepted: boolean;
    onChange: (accepted: boolean) => void;
    /** Classes additionnelles du conteneur (marges, encadré…) */
    className?: string;
    /** Mention complémentaire affichée après le lien, ex : « (obligatoire…) » */
    note?: string;
};

/**
 * Case d'acceptation des CGV — UI unique partagée par tous les points d'entrée
 * d'authentification (page /login, modale panier invité…). Le lien ouvre /cgv
 * dans un nouvel onglet sans perdre l'état de l'écran courant ; le lien est
 * volontairement HORS du <label> pour ne pas déclencher le toggle de la case.
 */
export default function CgvCheckbox({
    id,
    accepted,
    onChange,
    className = '',
    note,
}: CgvCheckboxProps) {
    return (
        <div className={`flex items-start gap-2.5 ${className}`}>
            <input
                id={id}
                type="checkbox"
                checked={accepted}
                onChange={(e) => onChange(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 accent-[#6D28D9] focus:ring-2 focus:ring-[#6D28D9]/20"
            />
            <p className="text-xs text-slate-600 leading-relaxed">
                <label htmlFor={id} className="cursor-pointer">
                    J&apos;accepte les{' '}
                </label>
                <Link
                    href="/cgv"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#6D28D9] hover:underline"
                >
                    Conditions Générales d&apos;Utilisation et de Vente
                </Link>
                {note ? ` ${note}` : '.'}
            </p>
        </div>
    );
}
