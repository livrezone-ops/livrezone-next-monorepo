"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/axios";
import { Loader2, Bell, Mail, MessageSquare, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

interface CategoryNode {
  id: number;
  name_fr: string;
}

export default function NotificationsPage() {
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [preferences, setPreferences] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Fetch categories for filtering
    const { data: refData } = useQuery<{ categories: CategoryNode[] }>({
        queryKey: ["referenceData"],
        queryFn: async () => {
            const { data } = await api.get("/reference-data");
            return data;
        }
    });

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
            return;
        }

        if (isAuthenticated) {
            fetchPreferences();
        }
    }, [isAuthenticated, authLoading]);

    const fetchPreferences = async () => {
        try {
            const { data } = await api.get('/profile/notifications');
            setPreferences(data.preferences || []);
        } catch (error) {
            console.error("Erreur:", error);
        } finally {
            setLoading(false);
        }
    };

    const getPref = (type: string, channel: string) => {
        const p = preferences.find(x => x.notification_type === type && x.channel === channel);
        if (p) return p.is_enabled;
        
        // Valeurs par défaut si non trouvé
        if (channel === 'email' || channel === 'in_app') return true;
        return false;
    };

    const getFilters = (type: string) => {
        // Assume filters are shared across channels for the same type for simplicity in UI
        const p = preferences.find(x => x.notification_type === type && x.filters);
        return p?.filters || {};
    };

    const handleToggle = (type: string, channel: string) => {
        const current = getPref(type, channel);
        const exists = preferences.find(x => x.notification_type === type && x.channel === channel);
        
        let newPrefs;
        if (exists) {
            newPrefs = preferences.map(x => 
                (x.notification_type === type && x.channel === channel) 
                    ? { ...x, is_enabled: !current } 
                    : x
            );
        } else {
            // Keep shared filters if they exist for this type
            const filters = getFilters(type);
            newPrefs = [...preferences, { notification_type: type, channel, is_enabled: !current, filters: Object.keys(filters).length ? filters : null }];
        }
        
        setPreferences(newPrefs);
    };

    const toggleCategoryFilter = (categoryId: number) => {
        const currentFilters = getFilters('book_orders');
        const currentCategories = currentFilters.categories || [];
        
        let newCategories;
        if (currentCategories.includes(categoryId)) {
            newCategories = currentCategories.filter((id: number) => id !== categoryId);
        } else {
            newCategories = [...currentCategories, categoryId];
        }

        // If all categories are unselected or selected, maybe we want to save them.
        // We'll update the filters for all 'book_orders' channels.
        
        const newPrefs = preferences.map(x => {
            if (x.notification_type === 'book_orders') {
                return { ...x, filters: { ...x.filters, categories: newCategories } };
            }
            return x;
        });

        // If no preference exists yet, we create a dummy one that will be saved later
        if (!newPrefs.some(x => x.notification_type === 'book_orders')) {
            newPrefs.push({
                notification_type: 'book_orders',
                channel: 'email',
                is_enabled: true,
                filters: { categories: newCategories }
            });
        }

        setPreferences(newPrefs);
    };

    const savePreferences = async () => {
        setSaving(true);
        try {
            const filters = getFilters('book_orders');
            
            const payload = [
                { notification_type: 'book_orders', channel: 'email', is_enabled: getPref('book_orders', 'email'), filters: Object.keys(filters).length ? filters : null },
                { notification_type: 'book_orders', channel: 'in_app', is_enabled: getPref('book_orders', 'in_app'), filters: Object.keys(filters).length ? filters : null },
                { notification_type: 'book_orders', channel: 'telegram', is_enabled: getPref('book_orders', 'telegram'), filters: Object.keys(filters).length ? filters : null },
                
                { notification_type: 'newsletter', channel: 'email', is_enabled: getPref('newsletter', 'email'), filters: null },
                { notification_type: 'promos', channel: 'email', is_enabled: getPref('promos', 'email'), filters: null },
            ];

            await api.post('/profile/notifications', { preferences: payload });
            alert("Préférences sauvegardées !");
        } catch (error) {
            console.error("Erreur sauvegarde:", error);
            alert("Erreur lors de la sauvegarde.");
        } finally {
            setSaving(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="animate-spin h-8 w-8 text-violet-600" />
            </div>
        );
    }

    const Toggle = ({ checked, onChange }: { checked: boolean, onChange: () => void }) => (
        <button 
            onClick={onChange}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${checked ? 'bg-[#6D28D9]' : 'bg-gray-200'}`}
        >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
    );

    const bookOrdersFilters = getFilters('book_orders').categories || [];
    // S'il n'y a pas de filtres, on considère que tout est coché par défaut.
    const isCategorySelected = (id: number) => {
        if (!getFilters('book_orders').categories) return true; 
        return bookOrdersFilters.includes(id);
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                    <Bell className="w-6 h-6 text-[#6D28D9]" /> Mes Notifications
                </h1>
                <p className="text-sm text-gray-500 mt-1">Gérez comment vous souhaitez être alerté sur LivreZone.</p>
            </div>

            <div className="space-y-6">
                {/* Bloc Commandes / Recherches */}
                <div className="bg-white rounded-xl border border-gray-150 p-6 shadow-sm">
                    <div className="mb-4 pb-4 border-b border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900">Nouvelles demandes de livres</h3>
                        <p className="text-sm text-gray-500">Soyez alerté lorsqu'un utilisateur cherche un livre (Réservé aux comptes Pro/Premium).</p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600"><Mail className="w-5 h-5"/></div>
                                <div>
                                    <p className="font-bold text-gray-900 text-sm">Par Email</p>
                                    <p className="text-xs text-gray-500">Recevez un récapitulatif par mail.</p>
                                </div>
                            </div>
                            <Toggle checked={getPref('book_orders', 'email')} onChange={() => handleToggle('book_orders', 'email')} />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center text-violet-600"><MessageSquare className="w-5 h-5"/></div>
                                <div>
                                    <p className="font-bold text-gray-900 text-sm">Messagerie interne</p>
                                    <p className="text-xs text-gray-500">Notification dans l'application.</p>
                                </div>
                            </div>
                            <Toggle checked={getPref('book_orders', 'in_app')} onChange={() => handleToggle('book_orders', 'in_app')} />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-sky-50 rounded-lg flex items-center justify-center text-sky-600"><Send className="w-5 h-5"/></div>
                                <div>
                                    <p className="font-bold text-gray-900 text-sm">Telegram <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded ml-1">Premium</span></p>
                                    <p className="text-xs text-gray-500">Alerte immédiate sur votre Telegram.</p>
                                </div>
                            </div>
                            <Toggle checked={getPref('book_orders', 'telegram')} onChange={() => handleToggle('book_orders', 'telegram')} />
                        </div>
                    </div>

                    {/* Filtres par catégories */}
                    {(getPref('book_orders', 'email') || getPref('book_orders', 'in_app') || getPref('book_orders', 'telegram')) && refData?.categories && (
                        <div className="mt-6 pt-4 border-t border-gray-100">
                            <p className="text-sm font-bold text-gray-900 mb-3">Filtrer par catégories :</p>
                            <p className="text-xs text-gray-500 mb-4">Sélectionnez les catégories pour lesquelles vous souhaitez être alerté.</p>
                            <div className="flex flex-wrap gap-2">
                                {refData.categories.map(cat => (
                                    <label key={cat.id} className={`cursor-pointer px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${isCategorySelected(cat.id) ? 'bg-violet-50 border-violet-200 text-violet-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                                        <input 
                                            type="checkbox" 
                                            className="hidden"
                                            checked={isCategorySelected(cat.id)}
                                            onChange={() => toggleCategoryFilter(cat.id)}
                                        />
                                        {cat.name_fr}
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Bloc Newsletters */}
                <div className="bg-white rounded-xl border border-gray-150 p-6 shadow-sm">
                    <div className="mb-4 pb-4 border-b border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900">Actualités et Promotions</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold text-gray-900 text-sm">Newsletter LivreZone</p>
                                <p className="text-xs text-gray-500">Nos nouveautés et conseils.</p>
                            </div>
                            <Toggle checked={getPref('newsletter', 'email')} onChange={() => handleToggle('newsletter', 'email')} />
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold text-gray-900 text-sm">Promotions des librairies</p>
                                <p className="text-xs text-gray-500">Offres exclusives de nos partenaires.</p>
                            </div>
                            <Toggle checked={getPref('promos', 'email')} onChange={() => handleToggle('promos', 'email')} />
                        </div>
                    </div>
                </div>
                
                <div className="flex justify-end pt-4">
                    <button 
                        onClick={savePreferences}
                        disabled={saving}
                        className="px-6 py-3 bg-[#6D28D9] text-white rounded-xl font-bold text-sm hover:bg-violet-800 transition-colors shadow-md disabled:opacity-70 flex items-center gap-2"
                    >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        Enregistrer les préférences
                    </button>
                </div>
            </div>
        </div>
    );
}
