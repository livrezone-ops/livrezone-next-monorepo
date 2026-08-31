"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import api from "@/lib/axios";
import { useAuth } from "@/hooks/useAuth";
import {
  Bell,
  Settings2,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Loader2,
} from "lucide-react";
import {
  type AppNotification,
  type InboxMeta,
  type NotificationTypeInfo,
  formatNotificationDate,
  mergeNotificationTypes,
  notificationHref,
} from "@/lib/notifications";

// Toast : composant stable défini au niveau module (jamais recréé à chaque
// rendu — règle React Compiler "Cannot create components during render").
function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 bg-gray-900 text-white text-sm font-bold px-4 py-3 rounded-xl shadow-lg">
      {message}
    </div>
  );
}

// Pagination fenêtrée : bornes + voisinage de la page courante, ellipses
// entre les trous. Perf : rendu O(1) même avec des milliers de pages.
function pageWindow(current: number, last: number): Array<number | "…"> {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const wanted = new Set([1, 2, current - 1, current, current + 1, last - 1, last]);
  const sorted = [...wanted].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

export default function NotificationsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

  const {
    data: inbox,
    isLoading,
    isFetching,
    isError,
  } = useQuery<{ notifications: AppNotification[]; meta: InboxMeta }>({
    queryKey: ["notifications", "inbox", page, typeFilter],
    queryFn: async () => {
      const { data } = await api.get("/notifications", {
        params: {
          page,
          ...(typeFilter !== "all" ? { type: typeFilter } : {}),
        },
      });
      return data;
    },
    enabled: isAuthenticated,
    // Navigation paginée fluide : conserve les résultats précédents le temps
    // du chargement (gros volumes) au lieu de réafficher un spinner.
    placeholderData: keepPreviousData,
  });

  // Filtres par type : synchronisés avec le registre backend (meta.types) —
  // un nouveau type ajouté côté API apparaît ici sans modification du front.
  const types: NotificationTypeInfo[] = useMemo(
    () => mergeNotificationTypes(inbox?.meta?.types),
    [inbox?.meta?.types]
  );

  const notifications: AppNotification[] = inbox?.notifications ?? [];
  const meta = inbox?.meta;
  const unreadCount = meta?.unread_count ?? 0;
  const lastPage = meta?.last_page ?? 1;

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  const changeFilter = (key: string) => {
    setTypeFilter(key);
    setPage(1); // retour à la première page du filtre sélectionné
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
      showToast("Toutes les notifications ont été marquées comme lues.");
    } catch (e) {
      console.error("Erreur:", e);
    }
  };

  const renderNotification = (n: AppNotification) => {
    const href = notificationHref(n);
    const unread = !n.read_at;
    const data = n.data || {};
    const title = typeof data.title === "string" ? data.title : "Notification";
    const message = typeof data.message === "string" ? data.message : "";

    const content = (
      <>
        <div className="flex items-start gap-3 flex-1">
          {unread && <span className="mt-1.5 w-2 h-2 rounded-full bg-[#6D28D9] shrink-0" />}
          <div className={unread ? "" : "pl-5"}>
            <p className={`text-sm ${unread ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>
              {title}
            </p>
            {message && message !== title && (
              <p className="text-xs text-gray-500 mt-0.5">{message}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">{formatNotificationDate(n.created_at)}</p>
          </div>
        </div>
        {unread && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              markRead(n.id);
            }}
            className="text-xs font-bold text-[#6D28D9] hover:text-violet-800 shrink-0 cursor-pointer"
          >
            Marquer comme lu
          </button>
        )}
      </>
    );

    const card = `flex items-center justify-between gap-3 p-4 rounded-xl border transition-colors ${
      unread ? "bg-violet-50/50 border-violet-100" : "bg-white border-gray-100"
    }`;

    // Notification cliquable (demandes => /demandes?search=...) : le clic
    // marque la notification comme lue puis redirige vers la demande.
    if (href) {
      return (
        <Link
          key={n.id}
          href={href}
          onClick={() => {
            if (unread) markRead(n.id);
          }}
          className={`${card} hover:border-violet-200`}
        >
          {content}
        </Link>
      );
    }
    return (
      <div key={n.id} className={card}>
        {content}
      </div>
    );
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-violet-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-[#6D28D9]" /> Mes Notifications
          </h1>
          <p className="text-sm text-gray-500 mt-1">Vos notifications internes LivreZone.</p>
        </div>
        {/* Accès direct au paramétrage (séparation consultation / réglages) */}
        <Link
          href="/dashboard/notifications/parametrage"
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-[#6D28D9] hover:bg-violet-50 hover:border-violet-200 transition-colors shadow-sm shrink-0"
        >
          <Settings2 className="w-4 h-4" /> Paramétrage
        </Link>
      </div>

      <div className="space-y-6">
        {/* Filtre par type (extensible via le registre backend meta.types) */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => changeFilter("all")}
            className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
              typeFilter === "all"
                ? "bg-[#6D28D9] border-[#6D28D9] text-white"
                : "bg-white border-gray-200 text-gray-500 hover:border-violet-200 hover:text-violet-700"
            }`}
          >
            Tous
          </button>
          {types.map((t) => (
            <button
              key={t.key}
              onClick={() => changeFilter(t.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                typeFilter === t.key
                  ? "bg-[#6D28D9] border-[#6D28D9] text-white"
                  : "bg-white border-gray-200 text-gray-500 hover:border-violet-200 hover:text-violet-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Boîte de réception in-app */}
        <div className="bg-white rounded-xl border border-gray-150 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Boîte de réception</h3>
              <p className="text-sm text-gray-500">
                {meta ? `${meta.total} notification${meta.total > 1 ? "s" : ""}` : "…"}
                {unreadCount > 0
                  ? ` · ${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`
                  : ""}
              </p>
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

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin h-7 w-7 text-violet-600" />
            </div>
          ) : isError ? (
            <p className="text-sm text-red-500 py-8 text-center">
              Impossible de charger vos notifications. Réessayez plus tard.
            </p>
          ) : notifications.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-3 text-center">
              <Inbox className="w-10 h-10 text-gray-300" />
              <p className="text-sm text-gray-500">
                Aucune notification{typeFilter !== "all" ? " pour ce type" : ""}.
              </p>
            </div>
          ) : (
            <div className={`space-y-3 ${isFetching ? "opacity-60 transition-opacity" : ""}`}>
              {notifications.map(renderNotification)}
            </div>
          )}
        </div>

        {/* Pagination fenêtrée */}
        {lastPage > 1 && (
          <div className="flex items-center justify-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-violet-700 hover:border-violet-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Page précédente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {pageWindow(page, lastPage).map((p, i) =>
              p === "…" ? (
                <span key={`gap-${i}`} className="px-1 text-xs text-gray-400">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`min-w-[2rem] px-2 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    p === page
                      ? "bg-[#6D28D9] text-white"
                      : "bg-white border border-gray-200 text-gray-500 hover:border-violet-200 hover:text-violet-700"
                  }`}
                >
                  {p}
                </button>
              )
            )}
            <button
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              disabled={page >= lastPage}
              className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-violet-700 hover:border-violet-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Page suivante"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {toast && <Toast message={toast} />}
    </div>
  );
}
