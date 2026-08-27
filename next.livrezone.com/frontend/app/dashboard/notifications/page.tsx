"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import { Loader2, Bell, Mail, MessageSquare, MessageCircle, Send, Check, Copy, Link2, Unlink, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

interface CategoryNode {
  id: number;
  name_fr: string;
}

interface AppNotification {
  id: string;
  type: string;
  data: Record<string, string>;
  read_at: string | null;
  created_at: string;
}

interface NotificationPreference {
  notification_type: string;
  channel: string;
  is_enabled: boolean;
  filters?: Record<string, unknown> | null;
}

export default function NotificationsPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // --- Liaison Telegram ---
  const [telegram, setTelegram] = useState<{ linked: boolean; deep_link?: string; token_expires_at?: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [page, setPage] = useState(1);

  // --- Inbox ---
  const {
    data: inbox,
    isLoading: inboxLoading,
  } = useQuery({
    queryKey: ["notifications", "inbox", page],
    queryFn: async () => {
      const { data } = await api.get("/notifications", { params: { page } });
      return data;
    },
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }

    if (isAuthenticated) {
      fetchPreferences();
      refreshTelegram();
    }
  }, [isAuthenticated, authLoading]);

  const fetchPreferences = async () => {
    try {
      const { data } = await api.get("/profile/notifications");
      setPreferences(data.preferences || []);
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshTelegram = async () => {
    setGenerating(true);
    try {
      const { data } = await api.get("/profile/telegram/link");
      setTelegram({ linked: !!data.linked, deep_link: data.deep_link, token_expires_at: data.token_expires_at });
    } catch (e) {
      console.error("Erreur Telegram:", e);
    } finally {
      setGenerating(false);
    }
  };

  const unlinkTelegram = async () => {
    setUnlinking(true);
    try {
      await api.post("/profile/telegram/unlink");
      setTelegram({ linked: false });
      pushToast("Telegram délié.");
    } catch (e) {
      console.error("Erreur:", e);
    } finally {
      setUnlinking(false);
    }
  };

  const copyLink = () => {
    if (telegram?.deep_link) {
      navigator.clipboard?.writeText(telegram.deep_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const markRead = async (id: string) => {
    try {
      await api.post(`/notifications/${id}/read`);
      queryClient.invalidateQueries({ queryKey: ["notifications", "inbox"] });
      queryClient.invalidateQueries({ queryKey: ["user"] });
    } catch (e) {
      console.error("Erreur:", e);
    }
  };

  const markAllRead = async () => {
    try {
      await api.post("/notifications/read-all");
      queryClient.invalidateQueries({ queryKey: ["notifications", "inbox"] });
      queryClient.invalidateQueries({ queryKey: ["user"] });
    } catch (e) {
      console.error("Erreur:", e);
    }
  };

  const pushToast = (message: string) => {
    alert(message);
  };

  const getPref = (type: string, channel: string) => {
    const p = preferences.find((x) => x.notification_type === type && x.channel === channel);
    if (p) return p.is_enabled;

    // Canal activé par défaut tant qu'aucune préférence n'a été enregistrée.
    return true;
  };

  const getFilters = (type: string) => {
    const p = preferences.find((x) => x.notification_type === type && x.filters);
    return p?.filters || {};
  };

  const handleToggle = (type: string, channel: string) => {
    const current = getPref(type, channel);
    const exists = preferences.find((x) => x.notification_type === type && x.channel === channel);

    let newPrefs;
    if (exists) {
      newPrefs = preferences.map((x) =>
        x.notification_type === type && x.channel === channel ? { ...x, is_enabled: !current } : x
      );
    } else {
      const filters = getFilters(type);
      newPrefs = [...preferences, { notification_type: type, channel, is_enabled: !current, filters: Object.keys(filters).length ? filters : null }];
    }

    setPreferences(newPrefs);
  };

  const toggleCategoryFilter = (categoryId: number) => {
    const allParentIds = refData?.parent_categories?.map((c) => c.id) ?? [];
    const stored = getFilters("book_orders").categories as number[] | undefined;
    const current = stored && stored.length > 0 ? stored : allParentIds;

    let newCategories: number[];
    if (current.includes(categoryId)) {
      newCategories = current.filter((id) => id !== categoryId);
    } else {
      newCategories = [...current, categoryId];
    }

    const newPrefs = preferences.map((x) => {
      if (x.notification_type === "book_orders") {
        return { ...x, filters: { ...x.filters, categories: newCategories } };
      }
      return x;
    });

    if (!newPrefs.some((x) => x.notification_type === "book_orders")) {
      newPrefs.push({
        notification_type: "book_orders",
        channel: "email",
        is_enabled: true,
        filters: { categories: newCategories },
      });
    }

    setPreferences(newPrefs);
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      const filters = getFilters("book_orders");

      const payload = [
        { notification_type: "book_orders", channel: "email", is_enabled: getPref("book_orders", "email"), filters: Object.keys(filters).length ? filters : null },
        { notification_type: "book_orders", channel: "in_app", is_enabled: getPref("book_orders", "in_app"), filters: Object.keys(filters).length ? filters : null },
        { notification_type: "book_orders", channel: "telegram", is_enabled: getPref("book_orders", "telegram"), filters: Object.keys(filters).length ? filters : null },
        { notification_type: "book_orders", channel: "whatsapp", is_enabled: getPref("book_orders", "whatsapp"), filters: Object.keys(filters).length ? filters : null },
        { notification_type: "newsletter", channel: "email", is_enabled: getPref("newsletter", "email"), filters: null },
        { notification_type: "promos", channel: "email", is_enabled: getPref("promos", "email"), filters: null },
      ];

      await api.post("/profile/notifications", { preferences: payload });
      pushToast("Préférences sauvegardées !");
    } catch (error) {
      console.error("Erreur sauvegarde:", error);
      pushToast("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  const { data: refData } = useQuery<{ parent_categories: CategoryNode[] }>({
    queryKey: ["referenceData"],
    queryFn: async () => {
      const { data } = await api.get("/reference-data");
      return data;
    },
    enabled: isAuthenticated,
  });

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-violet-600" />
      </div>
    );
  }

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${checked ? "bg-[#6D28D9]" : "bg-gray-200"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );

  const isCategorySelected = (id: number) => {
    const stored = getFilters("book_orders").categories as number[] | undefined;
    if (!stored || stored.length === 0) return true;
    return stored.includes(id);
  };

  const notifications: AppNotification[] = inbox?.notifications ?? [];
  const unreadCount = inbox?.meta?.unread_count ?? 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <Bell className="w-6 h-6 text-[#6D28D9]" /> Mes Notifications
        </h1>
        <p className="text-sm text-gray-500 mt-1">Gérez vos alertes et votre boîte de réception LivreZone.</p>
      </div>

      <div className="space-y-6">
        {/* Boîte de réception in-app */}
        <div className="bg-white rounded-xl border border-gray-150 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Boîte de réception</h3>
              <p className="text-sm text-gray-500">Vos notifications internes (commandes, messages…).</p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 text-xs font-bold text-[#6D28D9] hover:text-violet-800 transition-colors cursor-pointer"
              >
                <CheckCheck className="w-4 h-4" /> Tout marquer comme lu
              </button>
            )}
          </div>

          {inboxLoading ? (
            <div className="py-10 text-center text-sm text-gray-400 flex justify-center">
              <Loader2 className="animate-spin h-6 w-6" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">Aucune notification pour le moment.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {notifications.map((n) => (
                <li key={n.id} className={`py-3 flex items-start gap-3 ${n.read_at ? "opacity-60" : ""}`}>
                  <div className="mt-0.5 w-2 h-2 rounded-full shrink-0 bg-[#6D28D9]" style={{ visibility: n.read_at ? "hidden" : "visible" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{n.data?.message || n.data?.title || "Notification"}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {n.created_at ? new Date(n.created_at).toLocaleString("fr-FR") : ""}
                    </p>
                  </div>
                  {!n.read_at && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="text-[11px] font-bold text-gray-500 hover:text-[#6D28D9] transition-colors cursor-pointer shrink-0"
                    >
                      Marquer lu
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {inbox?.meta && inbox.meta.last_page > 1 && (
            <div className="mt-4 flex justify-center gap-2">
              {Array.from({ length: inbox.meta.last_page }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-2.5 py-1 rounded border text-xs cursor-pointer ${
                    p === page ? "border-[#6D28D9] bg-[#6D28D9] text-white" : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Liaison Telegram */}
        <div className="bg-white rounded-xl border border-gray-150 p-6 shadow-sm">
          <div className="mb-4 pb-4 border-b border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Send className="w-5 h-5 text-sky-600" /> Liaison Telegram
            </h3>
            <p className="text-sm text-gray-500">Recevez vos alertes directement sur Telegram (comptes Premium).</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className={`flex items-center gap-2 font-bold text-sm ${telegram?.linked ? "text-emerald-700" : "text-gray-700"}`}>
                {telegram?.linked ? (
                  <>
                    <Check className="w-5 h-5" /> Compte Telegram lié
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 text-sky-600" /> Telegram non lié
                  </>
                )}
              </div>
              {telegram?.linked && (
                <button
                  onClick={unlinkTelegram}
                  disabled={unlinking}
                  className="flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Unlink className="w-4 h-4" /> Délier
                </button>
              )}
            </div>

            <button
              onClick={refreshTelegram}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 text-white rounded-xl font-bold text-xs hover:bg-sky-700 transition-all shadow-xs disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              {telegram?.linked ? "Changer de compte Telegram" : "Générer le lien de liaison"}
            </button>

            {telegram?.deep_link && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                {telegram.linked && (
                  <p className="text-[11px] text-amber-700 mb-1">
                    ⚠️ Ce nouveau lien remplacera l’ancienne liaison : l’ancien chat Telegram ne recevra plus vos notifications.
                  </p>
                )}
                <p className="text-[11px] text-gray-500 mb-1">Ouvrez ce lien dans Telegram puis envoyez « /start » :</p>
                <div className="flex items-center gap-2">
                  <a
                    href={telegram.deep_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-[11px] text-sky-700 break-all bg-white border border-gray-200 rounded-lg px-2 py-1.5 hover:bg-sky-50 transition-colors"
                  >
                    {telegram.deep_link}
                  </a>
                  <button onClick={copyLink} className="p-1.5 text-gray-500 hover:text-[#6D28D9] cursor-pointer" title="Copier">
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Préférences de notification */}
        <div className="bg-white rounded-xl border border-gray-150 p-6 shadow-sm">
          <div className="mb-4 pb-4 border-b border-gray-100">
            <h3 className="text-lg font-bold text-gray-900">Nouvelles demandes de livres</h3>
            <p className="text-sm text-gray-500">Soyez alerté lorsqu’un utilisateur cherche un livre (Réservé aux comptes Pro/Premium).</p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600"><Mail className="w-5 h-5" /></div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">Par Email</p>
                  <p className="text-xs text-gray-500">Recevez un récapitulatif par mail.</p>
                </div>
              </div>
              <Toggle checked={getPref("book_orders", "email")} onChange={() => handleToggle("book_orders", "email")} />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center text-violet-600"><MessageSquare className="w-5 h-5" /></div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">Messagerie interne</p>
                  <p className="text-xs text-gray-500">Notification dans l’application.</p>
                </div>
              </div>
              <Toggle checked={getPref("book_orders", "in_app")} onChange={() => handleToggle("book_orders", "in_app")} />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-sky-50 rounded-lg flex items-center justify-center text-sky-600"><Send className="w-5 h-5" /></div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">Telegram <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded ml-1">Premium</span></p>
                  <p className="text-xs text-gray-500">Alerte immédiate sur votre Telegram.</p>
                </div>
              </div>
              <Toggle checked={getPref("book_orders", "telegram")} onChange={() => handleToggle("book_orders", "telegram")} />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600"><MessageCircle className="w-5 h-5" /></div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">WhatsApp</p>
                  <p className="text-xs text-gray-500">
                    Alerte quand un livre que vous cherchez est mis en vente. Nécessite un numéro de mobile dans votre{" "}
                    <Link href="/dashboard/profil" className="text-[#6D28D9] font-bold hover:underline">profil</Link>.
                  </p>
                </div>
              </div>
              <Toggle checked={getPref("book_orders", "whatsapp")} onChange={() => handleToggle("book_orders", "whatsapp")} />
            </div>
          </div>

          {(getPref("book_orders", "email") || getPref("book_orders", "in_app") || getPref("book_orders", "telegram")) && refData?.parent_categories && (
            <div className="mt-6 pt-4 border-t border-gray-100">
              <p className="text-sm font-bold text-gray-900 mb-3">Filtrer par catégories :</p>
              <p className="text-xs text-gray-500 mb-4">Sélectionnez les catégories pour lesquelles vous souhaitez être alerté.</p>
              <div className="flex flex-wrap gap-2">
                {refData.parent_categories.map((cat) => (
                  <label
                    key={cat.id}
                    className={`cursor-pointer px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                      isCategorySelected(cat.id) ? "bg-violet-50 border-violet-200 text-violet-700" : "bg-gray-50 border-gray-200 text-gray-500"
                    }`}
                  >
                    <input type="checkbox" className="hidden" checked={isCategorySelected(cat.id)} onChange={() => toggleCategoryFilter(cat.id)} />
                    {cat.name_fr}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Newsletters */}
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
              <Toggle checked={getPref("newsletter", "email")} onChange={() => handleToggle("newsletter", "email")} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-900 text-sm">Promotions des librairies</p>
                <p className="text-xs text-gray-500">Offres exclusives de nos partenaires.</p>
              </div>
              <Toggle checked={getPref("promos", "email")} onChange={() => handleToggle("promos", "email")} />
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
