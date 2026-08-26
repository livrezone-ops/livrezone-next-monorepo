'use client';

import { useState } from 'react';
import { Lock, Loader2, CheckCircle2 } from 'lucide-react';
import api from '@/lib/axios';
import { getApiErrorStatus, getApiFieldErrors } from '@/lib/api-error';
import { useToast } from '@/components/Toast';

export default function PasswordForm() {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const { success, error: showError } = useToast();

    const fieldError = (field: string) => {
        if (!errors[field]) return null;
        return (
            <p className="mt-1.5 text-xs text-red-500 font-medium flex items-center gap-1.5">
                <span className="inline-block h-1 w-1 rounded-full bg-red-500"></span>
                {errors[field][0]}
            </p>
        );
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSubmitting(true);
        setErrors({});

        try {
            await api.post('/profile/password', {
                current_password: currentPassword,
                password: newPassword,
                password_confirmation: confirmPassword,
            });

            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            success('Mot de passe mis à jour avec succès');
        } catch (error) {
            const fieldErrors = getApiFieldErrors(error);
            if (getApiErrorStatus(error) === 422 && Object.keys(fieldErrors).length > 0) {
                setErrors(fieldErrors);
            } else {
                showError('Erreur lors de la mise à jour du mot de passe');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="mt-6 sm:mt-8 w-full max-w-2xl">
            <div className="overflow-hidden rounded-2xl bg-white shadow-xl shadow-slate-200/40 ring-1 ring-slate-100">
                {/* En-tête */}
                <div className="border-b border-slate-100 bg-slate-50/50 p-5 sm:p-6 pb-4">
                    <h2 className="flex items-center gap-2 text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
                        <Lock className="h-5 w-5 text-[#6D28D9]" />
                        Modifier le mot de passe
                    </h2>
                    <p className="mt-1.5 text-sm text-slate-500">
                        Assurez-vous d’utiliser un mot de passe long et sécurisé.
                    </p>
                </div>

                <div className="p-5 sm:p-6 pt-4">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-xs sm:text-sm font-semibold text-slate-700">
                                Mot de passe actuel
                            </label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm text-slate-900 outline-none transition-all focus:border-[#6D28D9] focus:bg-white focus:ring-2 focus:ring-[#6D28D9]/20"
                                placeholder="Laisser vide si connecté via Google"
                            />
                            {fieldError('current_password')}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1.5 block text-xs sm:text-sm font-semibold text-slate-700">
                                    Nouveau mot de passe
                                </label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm text-slate-900 outline-none transition-all focus:border-[#6D28D9] focus:bg-white focus:ring-2 focus:ring-[#6D28D9]/20"
                                    required
                                />
                                {fieldError('password')}
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs sm:text-sm font-semibold text-slate-700">
                                    Confirmer le mot de passe
                                </label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm text-slate-900 outline-none transition-all focus:border-[#6D28D9] focus:bg-white focus:ring-2 focus:ring-[#6D28D9]/20"
                                    required
                                />
                                {fieldError('password_confirmation')}
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 mt-5">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full sm:w-auto px-6 h-11 flex items-center justify-center gap-2 rounded-xl bg-slate-800 text-sm font-semibold text-white shadow-xs transition-all hover:bg-slate-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Mise à jour...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-4 w-4" />
                                        <span>Mettre à jour le mot de passe</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
