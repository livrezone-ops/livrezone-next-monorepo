'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import api from '../../lib/axios';

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
}

interface ProfileResponse {
    profile: Profile | null;
    cities: City[];
}

interface ValidationErrors {
    [key: string]: string[];
}

export default function CompleteProfilePage() {
    const router = useRouter();
    const queryClient = useQueryClient();

    const [cities, setCities] = useState<City[]>([]);
    const [logo, setLogo] = useState<File | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const [errors, setErrors] = useState<ValidationErrors>({});

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
                }
            } catch (error: any) {
                if (error.response?.status === 401) {
                    router.replace('/login');
                    return;
                }

                setMessage(
                    'Impossible de charger les informations du profil.',
                );
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, [router]);


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

        Object.entries(form).forEach(([key, value]) => {
            formData.append(key, value);
        });

        formData.append('action', action);

        if (logo) {
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

            // Invalidate user cache so Header and Dashboard immediately reflect the new nickname/profile
            queryClient.invalidateQueries({ queryKey: ['user'] });

            if (action === 'confirm') {
                router.replace('/dashboard');
                router.refresh();
            }
        } catch (error: any) {
            if (error.response?.status === 401) {
                router.replace('/login');
                return;
            }

            if (error.response?.status === 422) {
                setErrors(error.response.data.errors ?? {});
                setMessage(
                    'Certains champs sont incorrects. Vérifie le formulaire.',
                );
                return;
            }

            setMessage(
                error.response?.data?.message ??
                    'Une erreur est survenue pendant l’enregistrement.',
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
            <p className="mt-1 text-sm text-red-600">
                {errors[field][0]}
            </p>
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
                        Paramètres du profil
                    </h1>

                    <p className="mt-2 text-sm text-gray-600">
                        Modifie tes informations personnelles.
                    </p>
                </div>

                {message && (
                    <div className="mb-6 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
                        {message}
                    </div>
                )}

                <form
                    onSubmit={(event) =>
                        submitProfile(event, 'confirm')
                    }
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
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                            placeholder="Exemple : bibliotheque-ouahib"
                        />

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
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
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
                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
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
                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                        >
                            <option value="étudiant(e)">
                                Étudiant(e)
                            </option>
                            <option value="passionné(e)">
                                Passionné(e)
                            </option>
                            <option value="librairie">
                                Librairie
                            </option>
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
                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
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
                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
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
                            className="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                            placeholder="Adresse facultative"
                        />

                        {fieldError('adresse')}
                    </div>

                    <div>
                        <label
                            htmlFor="logo"
                            className="mb-2 block text-sm font-medium text-gray-700"
                        >
                            Photo ou logo
                        </label>

                        <input
                            id="logo"
                            name="logo"
                            type="file"
                            accept="image/png,image/jpeg,image/gif,image/webp"
                            onChange={(event) =>
                                setLogo(event.target.files?.[0] ?? null)
                            }
                            className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-700"
                        />

                        <p className="mt-1 text-xs text-gray-500">
                            PNG, JPG, GIF ou WebP. Taille maximale : 2 Mo.
                        </p>

                        {fieldError('logo')}
                    </div>

                    <div className="flex flex-col gap-3 pt-4 sm:flex-row">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {submitting
                                ? 'Enregistrement...'
                                : 'Confirmer mon profil'}
                        </button>

                        <button
                            type="button"
                            disabled={submitting}
                            onClick={(event) =>
                                submitProfile(
                                    event as unknown as FormEvent<HTMLFormElement>,
                                    'later',
                                )
                            }
                            className="flex-1 rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Enregistrer pour plus tard
                        </button>
                    </div>
                </form>
            </div>
        </main>
    );
}