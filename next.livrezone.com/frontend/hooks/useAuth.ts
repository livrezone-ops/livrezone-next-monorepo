'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';

export interface User {
    id: number;
    name: string;
    email: string;
    profile: {
        nickname: string;
        logo: string;
    };
}

export function useAuth() {
    const queryClient = useQueryClient();

    const { data: user, isLoading, error } = useQuery<User>({
        queryKey: ['user'],
        queryFn: async () => {
            const { data } = await api.get('/user');
            return data;
        },
        retry: false,
    });

    const logoutMutation = useMutation({
        mutationFn: async () => {
            await api.post('/auth/logout');
        },
        onSuccess: () => {
            queryClient.setQueryData(['user'], null);
            window.location.href = '/login';
        }
    });

    const loginWithProvider = async (provider: string) => {
        await api.get('https://api-next.livrezone.com/sanctum/csrf-cookie', { baseURL: '' });
        const { data } = await api.get(`/auth/redirect/${provider}`);
        window.location.href = data.url;
    };

    return {
        user,
        isLoading,
        isAuthenticated: !!user,
        loginWithProvider,
        logout: () => logoutMutation.mutate(),
    };
}
