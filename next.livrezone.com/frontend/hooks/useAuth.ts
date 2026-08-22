'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '../lib/axios';

const API_ROOT = (
    process.env.NEXT_PUBLIC_API_URL || 'https://api-next.livrezone.com/api'
).replace(/\/api$/, '');

async function ensureCsrf() {
    await api.get(`${API_ROOT}/sanctum/csrf-cookie`, { baseURL: '' });
}

export interface User {
    id: number;
    name: string;
    email: string;
    email_verified_at?: string | null;
    is_admin?: boolean;
    profile: {
        nickname: string;
        logo: string | null;
        avatar_mode?: string | null;
        subscription_type?: string;
    };
}

export function useAuth() {
    const queryClient = useQueryClient();
    const router = useRouter();

    const { data: user, isLoading } = useQuery<User>({
        queryKey: ['user'],
        queryFn: async () => {
            const { data } = await api.get('/user');
            return data;
        },
        retry: false,
        staleTime: 1000 * 60 * 5, // 5 minutes
        throwOnError: false,
    });

    const logoutMutation = useMutation({
        mutationFn: async () => {
            try {
                await api.post('/auth/logout');
            } catch {
                // Session déjà expirée côté back ou erreur réseau : on poursuit la déconnexion front
            }
        },
        onSettled: () => {
            queryClient.setQueryData(['user'], null);
            router.push('/login');
        }
    });

    const loginWithProvider = async (provider: string) => {
        await api.get('https://api-next.livrezone.com/sanctum/csrf-cookie', { baseURL: '' });
        const { data } = await api.get(`/auth/redirect/${provider}`);
        window.location.href = data.url;
    };

    const loginWithCredentials = async (email: string, password: string) => {
        await ensureCsrf();
        const { data } = await api.post('/auth/login', { email, password });
        queryClient.setQueryData(['user'], data.user);
        return data;
    };

    const registerUser = async (
        name: string,
        email: string,
        password: string,
        password_confirmation: string,
    ) => {
        await ensureCsrf();
        const { data } = await api.post('/auth/register', {
            name,
            email,
            password,
            password_confirmation,
        });
        return data;
    };

    const forgotPassword = async (email: string) => {
        const { data } = await api.post('/auth/forgot-password', { email });
        return data;
    };

    const resendVerification = async (email: string) => {
        const { data } = await api.post('/auth/email/verification-notification', {
            email,
        });
        return data;
    };

    const resetPassword = async (
        token: string,
        email: string,
        password: string,
        password_confirmation: string,
    ) => {
        const { data } = await api.post('/auth/reset-password', {
            token,
            email,
            password,
            password_confirmation,
        });
        return data;
    };

    return {
        user,
        isLoading,
        isAuthenticated: !!user,
        loginWithProvider,
        loginWithCredentials,
        registerUser,
        forgotPassword,
        resendVerification,
        resetPassword,
        logout: () => logoutMutation.mutate(),
    };
}
