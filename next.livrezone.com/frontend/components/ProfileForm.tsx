'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import { getApiErrorStatus, getApiFieldErrors, getApiErrorMessage } from '../lib/api-error';

interface City {
    id: number;
    name: string;
}

interface Profile {
    phone: string | null;
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
    if (!value) return '?';
    const parts = value.replace(/-/g, ' ').trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const second = parts[1]?.[0] ?? '';
    return (first + second).toUpperCase();
}

export default function ProfileForm({
    title = 'Compléter mon profil',
    subtitle = 'Ces informations permettent de personnaliser ton expérience LivreZone.',
    redirectPath,
}: ProfileFormProps) {
    const router = useRouter();
    const queryClient = useQueryClient();

    const [cities, setCities] = useState<City[]>([]);
    const [logo, setLogo] = useState<File | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const [errors, setErrors] = useState<ValidationErrors>({});

    const [avatarMode, setAvatarMode] = useState<string>('custom');
    const [userAvatar, setUserAvatar] = useState<string | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [initialLogo, setInitialLogo] = useState<string | null>(null);

    const [form, setForm] = useState({
        nickname: '',
        phone: '',
        city_id: '',
        profile_type: 'passionné(e)',
        subscription_type: 'free',
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
                        city_id: data.profile.city_id
                            ? String(data.profile.city_id)
                            : '',
                        profile_type:
                            data.profile.profile_type ?? 'passionné(e)',
                        subscription_type:
                            data.profile.subscription_type ?? 'free',
                        delivery_option:
                            data.profile.delivery_option ??
                            'selon destination',
                        adresse: data.profile.adresse ?? '',
                    });

                    if (data.profile.avatar_mode) {
                        setAvatarMode(data.profile.avatar_mode);
                    } else if (data.user?.avatar) {
                        setAvatarMode('google');
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
        if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back();
        } else {
            router.push('/dashboard');
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
            formData.append(key, value);
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

            setMessage(data.message ?? 'Profil enregistré avec succès.');
            queryClient.invalidateQueries({ queryKey: ['user'] });

            if (action === 'confirm') {
                if (redirectPath) {
                    router.replace(redirectPath);
                } else {
                    goBack();
                }
                router.refresh();
            } else {
                goBack();
            }
        } catch (error) {
            if (getApiErrorStatus(error) === 401) {
                router.replace('/login');
                return;
            }

            if (getApiErrorStatus(error) === 422) {
                setErrors(getApiFieldErrors(error));
                setMessage(
                    'Certains champs sont incorrects. Vérifie le formulaire.',
                );
                return;
            }

            setMessage(
                getApiErrorMessage(
                    error,
                    'Une erreur est survenue pendant l’enregistrement.',
                ),
            );
        } finally {
            setSubmitting(false);
        }
    };

    const fieldError = (field: string) => {
        if (!errors[field]?.length) {
            return null;
        }

        return (
            <p className="mt-1 text-sm text-red-600">{errors[field][0]}</p>
        );
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <p className="text-gray-600">Chargement du profil...</p>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50 px-4 py-10">
            <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-lg sm:p-10">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-gray-900">
                        {title}
                    </h1>
                    <p className="mt-2 text-sm text-gray-600">{subtitle}</p>
                </div>

                {message && (
                    <div className="mb-6 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
                        {message}
                    </div>
                )}

                <form
                    onSubmit={(event) => submitProfile(event, 'confirm')}
                    className="space-y-6"
                >
                    <div>
                        <label
                            htmlFor="nickname"
                            className="mb-2 block text-sm font-medium text-gray-700"
                        >
                            Pseudonyme
                        </label>

                        <input
                            id="nickname"
                            name="nickname"
                            value={form.nickname}
                            onChange={handleChange}
                            required
                            maxLength={255}
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                            placeholder="Exemple : bibliotheque-ouahib"
                        />

                        <p className="mt-1 text-xs text-gray-500">
                            Nom affiché publiquement dans tes publications et ta
                            bibliothèque.
                        </p>

                        {fieldError('nickname')}
                    </div>

                    <div>
                        <label
                            htmlFor="phone"
                            className="mb-2 block text-sm font-medium text-gray-700"
                        >
                            Téléphone
                        </label>

                        <input
                            id="phone"
                            name="phone"
                            type="tel"
                            inputMode="numeric"
                            value={form.phone}
                            onChange={handleChange}
                            maxLength={10}
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                            placeholder="0612345678"
                        />

                        {fieldError('phone')}
                    </div>

                    <div>
                        <label
                            htmlFor="city_id"
                            className="mb-2 block text-sm font-medium text-gray-700"
                        >
                            Ville
                        </label>

                        <select
                            id="city_id"
                            name="city_id"
                            value={form.city_id}
                            onChange={handleChange}
                            required
                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                        >
                            <option value="">Choisir une ville</option>

                            {cities.map((city) => (
                                <option key={city.id} value={city.id}>
                                    {city.name}
                                </option>
                            ))}
                        </select>

                        {fieldError('city_id')}
                    </div>

                    <div>
                        <label
                            htmlFor="profile_type"
                            className="mb-2 block text-sm font-medium text-gray-700"
                        >
                            Type de profil
                        </label>

                        <select
                            id="profile_type"
                            name="profile_type"
                            value={form.profile_type}
                            onChange={handleChange}
                            required
                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                        >
                            <option value="étudiant(e)">Étudiant(e)</option>
                            <option value="passionné(e)">Passionné(e)</option>
                            <option value="librairie">Librairie</option>
                        </select>

                        {fieldError('profile_type')}
                    </div>

                    <div>
                        <label
                            htmlFor="subscription_type"
                            className="mb-2 block text-sm font-medium text-gray-700"
                        >
                            Abonnement
                        </label>

                        <select
                            id="subscription_type"
                            name="subscription_type"
                            value={form.subscription_type}
                            onChange={handleChange}
                            required
                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                        >
                            <option value="free">Gratuit</option>
                            <option value="premium">Premium</option>
                        </select>

                        {fieldError('subscription_type')}
                    </div>

                    <div>
                        <label
                            htmlFor="delivery_option"
                            className="mb-2 block text-sm font-medium text-gray-700"
                        >
                            Livraison disponible
                        </label>

                        <select
                            id="delivery_option"
                            name="delivery_option"
                            value={form.delivery_option}
                            onChange={handleChange}
                            required
                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                        >
                            <option value="oui">Oui</option>
                            <option value="non">Non</option>
                            <option value="selon destination">
                                Selon la destination
                            </option>
                        </select>

                        {fieldError('delivery_option')}
                    </div>

                    <div>
                        <label
                            htmlFor="adresse"
                            className="mb-2 block text-sm font-medium text-gray-700"
                        >
                            Adresse
                        </label>

                        <textarea
                            id="adresse"
                            name="adresse"
                            value={form.adresse}
                            onChange={handleChange}
                            maxLength={500}
                            rows={3}
                            className="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                            placeholder="Adresse facultative"
                        />

                        {fieldError('adresse')}
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                            Photo de profil
                        </label>

                        <p className="mb-3 text-xs text-gray-500">
                            Choisis comment afficher ton avatar publiquement.
                        </p>

                        <div className="grid grid-cols-3 gap-3">
                            <button
                                type="button"
                                onClick={() => setAvatarMode('google')}
                                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-center text-sm font-medium transition ${
                                    avatarMode === 'google'
                                        ? 'border-violet-600 bg-violet-50 text-violet-700'
                                        : 'border-gray-200 text-gray-500 hover:border-violet-300'
                                }`}
                            >
                                {userAvatar ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={userAvatar}
                                        alt="Google"
                                        className="h-14 w-14 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                                        —
                                    </div>
                                )}
                                Google
                            </button>

                            <button
                                type="button"
                                onClick={() => setAvatarMode('initials')}
                                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-center text-sm font-medium transition ${
                                    avatarMode === 'initials'
                                        ? 'border-violet-600 bg-violet-50 text-violet-700'
                                        : 'border-gray-200 text-gray-500 hover:border-violet-300'
                                }`}
                            >
                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-600 text-lg font-bold text-white">
                                    {getInitials(form.nickname || 'LZ')}
                                </div>
                                Initiales
                            </button>

                            <button
                                type="button"
                                onClick={() => setAvatarMode('custom')}
                                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-center text-sm font-medium transition ${
                                    avatarMode === 'custom'
                                        ? 'border-violet-600 bg-violet-50 text-violet-700'
                                        : 'border-gray-200 text-gray-500 hover:border-violet-300'
                                }`}
                            >
                                {logoPreview ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={logoPreview}
                                        alt="Aperçu"
                                        className="h-14 w-14 rounded-full object-cover"
                                    />
                                ) : initialLogo && !initialLogo.startsWith('http') ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={`https://api-next.livrezone.com${initialLogo}`}
                                        alt="Logo actuel"
                                        className="h-14 w-14 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-2xl text-gray-400">
                                        +
                                    </div>
                                )}
                                Importer
                            </button>
                        </div>

                        {avatarMode === 'custom' && (
                            <div className="mt-3">
                                <input
                                    id="logo"
                                    name="logo"
                                    type="file"
                                    accept="image/png,image/jpeg,image/gif,image/webp"
                                    onChange={(event) => {
                                        const file =
                                            event.target.files?.[0] ?? null;
                                        setLogo(file);
                                        setLogoPreview(
                                            file
                                                ? URL.createObjectURL(file)
                                                : null,
                                        );
                                    }}
                                    className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-700"
                                />

                                {(logoPreview ||
                                    (initialLogo &&
                                        !initialLogo.startsWith('http'))) && (
                                    <div className="mt-3 flex items-center gap-3 rounded-lg border border-violet-100 bg-violet-50 p-3">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={
                                                logoPreview ||
                                                `https://api-next.livrezone.com${initialLogo}`
                                            }
                                            alt="Aperçu du logo importé"
                                            className="h-20 w-20 rounded-full object-cover border-2 border-white shadow"
                                        />
                                        <div className="min-w-0 text-sm">
                                            <p className="font-medium text-violet-800">
                                                Aperçu de ton logo
                                            </p>
                                            <p className="truncate text-xs text-gray-500">
                                                {logo?.name || 'Logo importé'}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <p className="mt-1 text-xs text-gray-500">
                                    PNG, JPG, GIF ou WebP. Taille maximale : 2
                                    Mo.
                                </p>
                            </div>
                        )}

                        {fieldError('logo')}
                    </div>

                    <div className="flex flex-col gap-3 pt-4 sm:flex-row">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 rounded-lg bg-violet-700 px-6 py-3 font-medium text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {submitting
                                ? 'Enregistrement...'
                                : 'Confirmer mon profil'}
                        </button>

                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => goBack()}
                            className="flex-1 rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Plus tard
                        </button>
                    </div>
                </form>
            </div>
        </main>
    );
}
