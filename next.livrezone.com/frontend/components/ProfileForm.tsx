'use client';

import React, { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import { getApiErrorStatus, getApiFieldErrors, getApiErrorMessage } from '../lib/api-error';
import Logo from '@/components/Logo';
import ToastContainer, { ToastData, ToastType } from '@/components/Toast';
import {
    User as UserIcon,
    Phone,
    MapPin,
    Building,
    CreditCard,
    Truck,
    Home,
    Camera,
    UploadCloud,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    Sparkles,
} from 'lucide-react';

interface City {
    id: number;
    name: string;
}

interface Profile {
    phone: string | null;
    has_whatsapp?: boolean | null;
    city_id: number | null;
    profile_type: string;
    subscription_type: string;
    delivery_option: string;
    nickname: string;
    adresse: string | null;
    logo: string | null;
    avatar_mode?: string | null;
    avatar_upload?: string | null;
}

interface ProfileResponse {
    user?: {
        avatar: string | null;
    };
    profile: Profile | null;
    cities: City[];
}

interface ValidationErrors {
    [key: string]: string[];
}

interface ProfileFormProps {
    title?: string;
    subtitle?: string;
    /** Si défini, redirige vers cette route après confirmation. Sinon reste sur la page. */
    redirectPath?: string;
}

function getInitials(value: string): string {
    if (!value) return 'LZ';
    const parts = value.replace(/[-_]/g, ' ').trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const second = parts[1]?.[0] ?? '';
    return (first + second).toUpperCase() || 'LZ';
}

export default function ProfileForm({
    title = 'Compléter mon profil',
    subtitle = 'Ces informations permettent de personnaliser votre expérience LivreZone.',
    redirectPath,
}: ProfileFormProps) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Toasts
    const [toasts, setToasts] = useState<ToastData[]>([]);
    const toastIdRef = useRef(0);

    const pushToast = (toastMessage: string, type: ToastType = 'success') => {
        const id = ++toastIdRef.current;
        setToasts((prev) => [...prev, { id, message: toastMessage, type }]);

        setTimeout(() => {
            setToasts((prev) =>
                prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
            );
            setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
            }, 300);
        }, 4000);
    };

    const dismissToast = (id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    const [cities, setCities] = useState<City[]>([]);
    const [logo, setLogo] = useState<File | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const [errors, setErrors] = useState<ValidationErrors>({});

    const [avatarMode, setAvatarMode] = useState<string>('initials');
    const [userAvatar, setUserAvatar] = useState<string | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [initialLogo, setInitialLogo] = useState<string | null>(null);

    const [form, setForm] = useState({
        nickname: '',
        phone: '',
        has_whatsapp: true,
        city_id: '',
        profile_type: 'passionné(e)',

        delivery_option: 'selon destination',
        adresse: '',
    });

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const { data } = await api.get<ProfileResponse>('/profile');

                setCities(data.cities);

                if (data.user?.avatar) {
                    setUserAvatar(data.user.avatar);
                }

                if (data.profile) {
                    setForm({
                        nickname: data.profile.nickname ?? '',
                        phone: data.profile.phone ?? '',
                        has_whatsapp:
                            data.profile.has_whatsapp !== undefined &&
                            data.profile.has_whatsapp !== null
                                ? Boolean(data.profile.has_whatsapp)
                                : true,
                        city_id: data.profile.city_id
                            ? String(data.profile.city_id)
                            : '',
                        profile_type:
                            data.profile.profile_type ?? 'passionné(e)',

                        delivery_option:
                            data.profile.delivery_option ??
                            'selon destination',
                        adresse: data.profile.adresse ?? '',
                    });

                    if (data.profile.avatar_mode) {
                        setAvatarMode(data.profile.avatar_mode);
                    } else if (data.user?.avatar) {
                        setAvatarMode('google');
                    } else if (data.profile.logo) {
                        setAvatarMode('custom');
                    } else {
                        setAvatarMode('initials');
                    }

                    if (data.profile.avatar_upload) {
                        setInitialLogo(data.profile.avatar_upload);
                    } else if (
                        data.profile.logo &&
                        !data.profile.logo.startsWith('http')
                    ) {
                        setInitialLogo(data.profile.logo);
                    }
                }
            } catch (error) {
                if (getApiErrorStatus(error) === 401) {
                    router.replace('/login');
                    return;
                }

                setMessage('Impossible de charger les informations du profil.');
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, [router]);

    const goBack = () => {
        if (typeof window !== 'undefined') {
            const referrer = document.referrer;
            // Si on a tapé l'URL directement (vide) ou qu'on vient d'une page profile (boucle), on redirige vers l'accueil (welcome) ou le dashboard
            if (!referrer || referrer.includes('/profile')) {
                router.push('/');
            } else if (window.history.length > 1) {
                router.back();
            } else {
                router.push('/dashboard');
            }
        }
    };

    const handleChange = (
        event: ChangeEvent<
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >
    ) => {
        const { name, value } = event.target;

        setForm((current) => ({
            ...current,
            [name]: value,
        }));

        setErrors((current) => ({
            ...current,
            [name]: [],
        }));
    };

    const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        const clean = val.replace(/[^0-9]/g, '');
        const isLandline = /^(?:05|2125|5\d{8})/.test(clean);
        setForm((current) => ({
            ...current,
            phone: val,
            has_whatsapp: isLandline ? false : (clean.startsWith('06') || clean.startsWith('07') ? true : current.has_whatsapp),
        }));
        setErrors((current) => ({
            ...current,
            phone: [],
        }));
    };

    const handleCustomImageClick = () => {
        setAvatarMode('custom');
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null;
        if (file) {
            setLogo(file);
            setLogoPreview(URL.createObjectURL(file));
            setAvatarMode('custom');
        }
    };

    const submitProfile = async (
        event: FormEvent<HTMLFormElement>,
        action: 'confirm' | 'later',
    ) => {
        event.preventDefault();

        setSubmitting(true);
        setMessage('');
        setErrors({});

        const formData = new FormData();
        const values = { ...form };

        if (action === 'later' && !values.city_id && cities.length) {
            values.city_id = String(cities[0].id);
        }

        Object.entries(values).forEach(([key, value]) => {
            if (key === 'has_whatsapp') {
                formData.append(key, value ? '1' : '0');
            } else {
                formData.append(key, String(value));
            }
        });

        formData.append('action', action);
        formData.append('avatar_mode', avatarMode);

        if (avatarMode === 'custom' && logo) {
            formData.append('logo', logo);
        }

        try {
            const { data } = await api.post('/profile', formData, {
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'multipart/form-data',
                },
            });

            const successMsg = data.message ?? 'Profil enregistré avec succès !';
            setMessage(successMsg);
            pushToast(successMsg, 'success');
            queryClient.invalidateQueries({ queryKey: ['user'] });

            if (action === 'confirm') {
                setTimeout(() => {
                    if (redirectPath) {
                        router.replace(redirectPath);
                    } else {
                        // Si pas de redirectPath, on utilise goBack pour revenir en arrière
                        goBack();
                    }
                    router.refresh();
                }, 1000);
            } else {
                goBack();
            }
        } catch (error) {
            if (getApiErrorStatus(error) === 401) {
                router.replace('/login');
                return;
            }

            if (getApiErrorStatus(error) === 422) {
                const fieldErrors = getApiFieldErrors(error);
                setErrors(fieldErrors);
                const errMsg = 'Certains champs sont incorrects. Vérifiez le formulaire.';
                setMessage(errMsg);
                pushToast(errMsg, 'error');
                return;
            }

            const errMsg = getApiErrorMessage(
                error,
                'Une erreur est survenue pendant l’enregistrement.',
            );
            setMessage(errMsg);
            pushToast(errMsg, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const fieldError = (field: string) => {
        if (!errors[field]?.length) {
            return null;
        }

        return (
            <p className="mt-1 text-xs text-rose-600 font-medium">{errors[field][0]}</p>
        );
    };

    if (loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="flex items-center gap-3 text-slate-600">
                    <Loader2 className="h-6 w-6 animate-spin text-[#6D28D9]" />
                    <span className="text-sm font-medium">Chargement du profil...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col items-center justify-start bg-gradient-to-b from-slate-50 via-slate-50 to-purple-50/20 px-4 pt-5 pb-12 sm:pt-7 sm:pb-16">
            <ToastContainer toasts={toasts} dismiss={dismissToast} />
            <div className="w-full max-w-[680px]">
                
                {/* Carte principale */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 md:p-9 shadow-xl shadow-slate-100/80">
                    
                    {/* Header Logo + Titre */}
                    <div className="mb-6 text-center">
                        <div className="flex justify-center">
                            <Logo size="lg" href="/" />
                        </div>
                        <h1 className="mt-3 text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                            {title}
                        </h1>
                        <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
                            {subtitle}
                        </p>
                    </div>

                    {/* Notification Erreur générale (Style Dashboard) */}
                    {errors && Object.keys(errors).length > 0 && (
                        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-xs sm:text-sm text-rose-700 shadow-2xs">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                            <div className="flex-1 font-medium">
                                {message || 'Certains champs sont incorrects. Vérifiez les informations saisies.'}
                            </div>
                        </div>
                    )}

                    {/* Notification Succès (Style Dashboard) */}
                    {message && Object.keys(errors).length === 0 && (
                        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-violet-200 bg-violet-50/90 p-3 text-xs sm:text-sm text-violet-800 shadow-2xs">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#6D28D9] mt-0.5" />
                            <div className="flex-1 font-medium">{message}</div>
                        </div>
                    )}

                    <form
                        onSubmit={(event) => submitProfile(event, 'confirm')}
                        className="space-y-4 sm:space-y-5"
                    >
                        {/* 1. SECTION AVATAR (3 OPTIONS CLIC DIRECT) */}
                        <div>
                            <label className="mb-1.5 block text-xs sm:text-sm font-semibold text-slate-700">
                                Photo de profil & Avatar
                            </label>
                            <p className="mb-2.5 text-[11px] sm:text-xs text-slate-500">
                                Choisissez comment votre avatar apparaît publiquement aux acheteurs et vendeurs.
                            </p>

                            <input
                                ref={fileInputRef}
                                id="avatar-file-input"
                                type="file"
                                accept="image/png,image/jpeg,image/gif,image/webp"
                                onChange={handleFileChange}
                                className="hidden"
                            />

                            <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
                                {/* Option A: Google */}
                                <button
                                    type="button"
                                    onClick={() => setAvatarMode('google')}
                                    disabled={!userAvatar}
                                    className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-3 text-center transition-all ${
                                        avatarMode === 'google'
                                            ? 'border-[#6D28D9] bg-violet-50/70 shadow-xs'
                                            : 'border-slate-200/80 bg-slate-50/50 hover:border-slate-300 hover:bg-white'
                                    } ${!userAvatar ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                    {avatarMode === 'google' && (
                                        <div className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#6D28D9] text-white">
                                            <CheckCircle2 className="h-3 w-3" />
                                        </div>
                                    )}
                                    {userAvatar ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={userAvatar}
                                            alt="Google"
                                            className="h-12 w-12 sm:h-14 sm:w-14 rounded-full object-cover border-2 border-white shadow-xs"
                                        />
                                    ) : (
                                        <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-slate-200 text-slate-400 font-bold text-sm">
                                            G
                                        </div>
                                    )}
                                    <span className="text-xs font-semibold text-slate-800">
                                        Google
                                    </span>
                                </button>

                                {/* Option B: Initiales dynamiques */}
                                <button
                                    type="button"
                                    onClick={() => setAvatarMode('initials')}
                                    className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-3 text-center transition-all cursor-pointer ${
                                        avatarMode === 'initials'
                                            ? 'border-[#6D28D9] bg-violet-50/70 shadow-xs'
                                            : 'border-slate-200/80 bg-slate-50/50 hover:border-slate-300 hover:bg-white'
                                    }`}
                                >
                                    {avatarMode === 'initials' && (
                                        <div className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#6D28D9] text-white">
                                            <CheckCircle2 className="h-3 w-3" />
                                        </div>
                                    )}
                                    <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-gradient-to-tr from-[#5B21B6] to-[#7C3AED] text-sm sm:text-base font-black text-white shadow-xs">
                                        {getInitials(form.nickname || 'LZ')}
                                    </div>
                                    <span className="text-xs font-semibold text-slate-800">
                                        Initiales
                                    </span>
                                </button>

                                {/* Option C: Importer Image (Directement cliquable) */}
                                <div
                                    onClick={handleCustomImageClick}
                                    role="button"
                                    tabIndex={0}
                                    className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-3 text-center transition-all cursor-pointer ${
                                        avatarMode === 'custom'
                                            ? 'border-[#6D28D9] bg-violet-50/70 shadow-xs'
                                            : 'border-slate-200/80 bg-slate-50/50 hover:border-slate-300 hover:bg-white'
                                    }`}
                                >
                                    {avatarMode === 'custom' && (
                                        <div className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#6D28D9] text-white">
                                            <CheckCircle2 className="h-3 w-3" />
                                        </div>
                                    )}
                                    {logoPreview ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <div className="relative group/avatar">
                                            <img
                                                src={logoPreview}
                                                alt="Aperçu"
                                                className="h-12 w-12 sm:h-14 sm:w-14 rounded-full object-cover border-2 border-white shadow-xs"
                                            />
                                            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity text-white">
                                                <Camera className="h-4 w-4" />
                                            </div>
                                        </div>
                                    ) : initialLogo && !initialLogo.startsWith('http') ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <div className="relative group/avatar">
                                            <img
                                                src={`https://api-next.livrezone.com${initialLogo}`}
                                                alt="Logo actuel"
                                                className="h-12 w-12 sm:h-14 sm:w-14 rounded-full object-cover border-2 border-white shadow-xs"
                                            />
                                            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity text-white">
                                                <Camera className="h-4 w-4" />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full border border-dashed border-slate-300 bg-white text-slate-500 hover:border-[#6D28D9] hover:text-[#6D28D9] transition-colors">
                                            <UploadCloud className="h-5 w-5" />
                                        </div>
                                    )}
                                    <span className="text-xs font-semibold text-slate-800">
                                        {logoPreview || initialLogo ? 'Changer logo' : 'Importer logo'}
                                    </span>
                                </div>
                            </div>
                            {fieldError('logo')}
                        </div>

                        {/* 2. LIGNE 1 : PSEUDONYME (GAUCHE) & TÉLÉPHONE (DROITE) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label
                                    htmlFor="nickname"
                                    className="mb-1.5 block text-xs sm:text-sm font-semibold text-slate-700"
                                >
                                    Pseudonyme
                                </label>

                                <div className="relative">
                                    <UserIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        id="nickname"
                                        name="nickname"
                                        value={form.nickname}
                                        onChange={handleChange}
                                        required
                                        maxLength={255}
                                        className="h-11 sm:h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-11 pr-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#6D28D9] focus:bg-white focus:ring-2 focus:ring-[#6D28D9]/20"
                                        placeholder="Ex: Fertilane"
                                    />
                                </div>

                                <p className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
                                    <Sparkles className="h-3 w-3 text-[#6D28D9] shrink-0" />
                                    <span>Nom affiché publiquement.</span>
                                </p>

                                {fieldError('nickname')}
                            </div>

                            <div>
                                <label
                                    htmlFor="phone"
                                    className="mb-1.5 block text-xs sm:text-sm font-semibold text-slate-700"
                                >
                                    Téléphone
                                </label>

                                <div className="relative">
                                    <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        id="phone"
                                        name="phone"
                                        type="tel"
                                        inputMode="numeric"
                                        value={form.phone}
                                        onChange={handlePhoneChange}
                                        maxLength={10}
                                        className="h-11 sm:h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-11 pr-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#6D28D9] focus:bg-white focus:ring-2 focus:ring-[#6D28D9]/20"
                                        placeholder="0612345678"
                                    />
                                </div>

                                <div className="mt-2.5 flex items-center justify-between">
                                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            name="has_whatsapp"
                                            checked={form.has_whatsapp}
                                            onChange={(e) =>
                                                setForm((curr) => ({
                                                    ...curr,
                                                    has_whatsapp: e.target.checked,
                                                }))
                                            }
                                            className="h-4 w-4 rounded border-slate-300 text-[#25D366] focus:ring-[#25D366]/20 accent-[#25D366] cursor-pointer"
                                        />
                                        <span className="flex items-center gap-1.5">
                                            <span
                                                className={`inline-block w-2 h-2 rounded-full ${
                                                    form.has_whatsapp
                                                        ? 'bg-[#25D366]'
                                                        : 'bg-slate-300'
                                                }`}
                                            ></span>
                                            Joignable sur WhatsApp
                                        </span>
                                    </label>
                                    <span className="text-[10px] text-slate-400">
                                        Format 10 chiffres (ex: 06...)
                                    </span>
                                </div>

                                {fieldError('phone')}
                            </div>
                        </div>

                        {/* 3. LIGNE 2 : VILLE (GAUCHE) & OPTION DE LIVRAISON (DROITE) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label
                                    htmlFor="city_id"
                                    className="mb-1.5 block text-xs sm:text-sm font-semibold text-slate-700"
                                >
                                    Ville
                                </label>

                                <div className="relative">
                                    <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <select
                                        id="city_id"
                                        name="city_id"
                                        value={form.city_id}
                                        onChange={handleChange}
                                        required
                                        className="h-11 sm:h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-11 pr-8 text-sm text-slate-900 outline-none transition-all focus:border-[#6D28D9] focus:bg-white focus:ring-2 focus:ring-[#6D28D9]/20 cursor-pointer appearance-none"
                                    >
                                        <option value="">Choisir une ville...</option>
                                        {cities.map((city) => (
                                            <option key={city.id} value={city.id}>
                                                {city.name}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                                        ▼
                                    </div>
                                </div>

                                {fieldError('city_id')}
                            </div>

                            <div>
                                <label
                                    htmlFor="delivery_option"
                                    className="mb-1.5 block text-xs sm:text-sm font-semibold text-slate-700"
                                >
                                    Option de livraison
                                </label>

                                <div className="relative">
                                    <Truck className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <select
                                        id="delivery_option"
                                        name="delivery_option"
                                        value={form.delivery_option}
                                        onChange={handleChange}
                                        required
                                        className="h-11 sm:h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-11 pr-8 text-sm text-slate-900 outline-none transition-all focus:border-[#6D28D9] focus:bg-white focus:ring-2 focus:ring-[#6D28D9]/20 cursor-pointer appearance-none"
                                    >
                                        <option value="oui">Assure la livraison</option>
                                        <option value="non">Pas de livraison</option>
                                        <option value="selon destination">Selon la destination</option>
                                    </select>
                                    <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                                        ▼
                                    </div>
                                </div>

                                {fieldError('delivery_option')}
                            </div>
                        </div>

                        {/* 4. LIGNE 3 : TYPE DE PROFIL (GAUCHE) & TYPE D'ABONNEMENT (DROITE) */}
                        {/* 4. LIGNE 3 : TYPE DE PROFIL (PLEINE LARGEUR) */}
                        <div>
                            <label
                                htmlFor="profile_type"
                                className="mb-1.5 block text-xs sm:text-sm font-semibold text-slate-700"
                            >
                                Type de profil
                            </label>

                            <div className="relative">
                                <Building className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <select
                                    id="profile_type"
                                    name="profile_type"
                                    value={form.profile_type}
                                    onChange={handleChange}
                                    required
                                    className="h-11 sm:h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-11 pr-8 text-sm text-slate-900 outline-none transition-all focus:border-[#6D28D9] focus:bg-white focus:ring-2 focus:ring-[#6D28D9]/20 cursor-pointer appearance-none"
                                >
                                    <option value="passionné(e)">Passionné(e)</option>
                                    <option value="étudiant(e)">Étudiant(e)</option>
                                    <option value="librairie">Librairie</option>
                                </select>
                                <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                                    ▼
                                </div>
                            </div>

                            {fieldError('profile_type')}
                        </div>

                        {/* 5. LIGNE 4 : ADRESSE EN 2 LIGNES (PLUS LONG & SPACIEUX) */}
                        <div>
                            <label
                                htmlFor="adresse"
                                className="mb-1.5 block text-xs sm:text-sm font-semibold text-slate-700"
                            >
                                Adresse <span className="text-slate-400 font-normal">(facultative)</span>
                            </label>

                            <div className="relative">
                                <Home className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
                                <textarea
                                    id="adresse"
                                    name="adresse"
                                    value={form.adresse}
                                    onChange={handleChange}
                                    maxLength={500}
                                    rows={2}
                                    className="w-full min-h-[72px] resize-none rounded-xl border border-slate-200 bg-slate-50/50 pl-11 pr-4 py-2.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#6D28D9] focus:bg-white focus:ring-2 focus:ring-[#6D28D9]/20"
                                    placeholder="Ex: Quartier, Rue, Bâtiment..."
                                />
                            </div>

                            {fieldError('adresse')}
                        </div>

                        {/* 6. BOUTONS D'ACTION (ESPACÉS DU DERNIER BLOC & TRÈS CONFORTABLES SUR MOBILE) */}
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-5 sm:pt-6 border-t border-slate-100">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full sm:flex-1 flex h-12 items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-6 text-sm font-semibold text-white shadow-xs transition-all hover:bg-[#5b21b6] hover:shadow-md hover:shadow-purple-500/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Enregistrement en cours...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-4 w-4" />
                                        <span>{redirectPath ? 'Confirmer mon profil' : 'Enregistrer les modifications'}</span>
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                disabled={submitting}
                                onClick={() => goBack()}
                                className="w-full sm:flex-1 flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {redirectPath ? 'Compléter plus tard' : 'Annuler'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
