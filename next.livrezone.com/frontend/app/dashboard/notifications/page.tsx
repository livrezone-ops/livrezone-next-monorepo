"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import api from "@/lib/axios";
import { useAuth } from "@/hooks/useAuth";
import {
  Bell,
  CheckCircle,
  Settings2,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Grid,
  Inbox,
  List,
  Loader2,
  Pin,
  PinOff,
} from "lucide-react";
import {
  type AppNotification,
  type InboxMeta,
  type NotificationTypeInfo,
  formatNotificationDate,
  mergeNotificationTypes,
  notificationHref,
  notificationTypeLabel,
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
  // Mode d'affichage, identique au dashboard (tableau sm+ / cartes partout).
  const [viewMode, setViewMode] = useState<"cards" | "table">("table");

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

  // Épinglage / désépinglage (toggle) — POST /notifications/{id}/pin.
  const togglePin = async (id: string) => {
    try {
      const { data: res } = await api.post<{ message: string }>(
        `/notifications/${id}/pin`
      );
      queryClient.invalidateQueries({ queryKey: ["notifications", "inbox"] });
      showToast(res.message ?? "Notification mise à jour.");
    } catch (e) {
      console.error("Erreur:", e);
      showToast("Impossible de modifier l'épinglage de cette notification.");
    }
  };

  // Masquage — POST /notifications/{id}/hide : sort la notification de la
  // liste (dismissed_at) sans la supprimer de la base.
  const hideNotification = async (id: string) => {
    try {
      await api.post(`/notifications/${id}/hide`);
      queryClient.invalidateQueries({ queryKey: ["notifications", "inbox"] });
      queryClient.invalidateQueries({ queryKey: ["user"] });
      showToast("Notification masquée.");
    } catch (e) {
      console.error("Erreur:", e);
      showToast("Impossible de masquer cette notification.");
    }
  };

  // Petit garde-fou : dans une carte cliquable (Link), les boutons ne doivent
  // pas déclencher la navigation — stop propagation + prévention du défaut.
  const guard =
    (fn: () => void) =>
    (e: { preventDefault: () => void; stopPropagation: () => void }) => {
      e.preventDefault();
      e.stopPropagation();
      fn();
    };

  // --- Vue TABLEAU (sm+) : table-fixed, aucun scroll horizontal.
  const renderRow = (n: AppNotification) => {
    const href = notificationHref(n);
    const unread = !n.read_at;
    const pinned = Boolean(n.pinned_at);
    const data = n.data || {};
    const title = typeof data.title === "string" ? data.title : "Notification";
    const message = typeof data.message === "string" ? data.message : "";
    const typeLabel = notificationTypeLabel(n);

    // Colonne titre : point non-lu, titre (+ aperçu), icône épinglée.
    const titleContent = (
      <>
        {unread && <span className="mt-1.5 w-2 h-2 rounded-full bg-[#6D28D9] shrink-0" />}
        <span className="min-w-0">
          <span
            className={`block truncate text-sm ${unread ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}
          >
            {title}
          </span>
          {message && message !== title && (
            <span className="block truncate text-xs text-gray-500 mt-0.5">{message}</span>
          )}
        </span>
        {pinned && (
          <span className="mt-0.5 shrink-0" title="Notification épinglée">
            <Pin className="w-3.5 h-3.5 text-[#6D28D9] fill-current" />
          </span>
        )}
      </>
    );

    // Notification cliquable (demandes => /demandes?search=...) : le clic
    // marque la notification comme lue puis redirige vers la demande.
    const titleCell =
      href ? (
        <Link
          href={href}
          onClick={() => {
            if (unread) markRead(n.id);
          }}
          className="flex items-start gap-2.5 min-w-0 hover:text-[#6D28D9] transition-colors"
        >
          {titleContent}
        </Link>
      ) : (
        <div className="flex items-start gap-2.5 min-w-0">{titleContent}</div>
      );

    return (
      <tr
        key={n.id}
        className={`transition-colors ${unread ? "bg-violet-50/50" : "hover:bg-gray-50/60"}`}
      >
        <td className="px-4 py-3.5 align-top">
          {titleCell}
          {unread && (
            <button
              onClick={() => markRead(n.id)}
              className="mt-1.5 ml-[18px] text-xs font-bold text-[#6D28D9] hover:text-violet-800 cursor-pointer"
            >
              Marquer comme lu
            </button>
          )}
        </td>
        <td className="px-4 py-3.5 text-xs text-gray-500 whitespace-nowrap align-top">
          {formatNotificationDate(n.created_at)}
        </td>
        <td className="px-4 py-3.5 align-top">
          <span className="inline-block px-2.5 py-1 rounded-full bg-violet-50 text-[#6D28D9] text-xs font-bold whitespace-nowrap">
            {typeLabel}
          </span>
        </td>
        <td className="px-4 py-3.5 align-top">
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => togglePin(n.id)}
              title={pinned ? "Désépingler" : "Épingler"}
              aria-label={pinned ? "Désépingler la notification" : "Épingler la notification"}
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                pinned
                  ? "border-[#6D28D9] bg-violet-50 text-[#6D28D9] hover:bg-violet-100"
                  : "border-gray-200 text-gray-500 hover:border-violet-200 hover:text-violet-700"
              }`}
            >
              {pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
            </button>
            <button
              onClick={() => hideNotification(n.id)}
              title="Masquer"
              aria-label="Masquer la notification"
              className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-600 transition-colors cursor-pointer"
            >
              <EyeOff className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  };
  // --- Vue CARTES : grille 2 à 3 cartes par ligne, style dashboard.
  const renderCard = (n: AppNotification) => {
    const href = notificationHref(n);
    const unread = !n.read_at;
    const pinned = Boolean(n.pinned_at);
    const data = n.data || {};
    const title = typeof data.title === "string" ? data.title : "Notification";
    const message = typeof data.message === "string" ? data.message : "";
    const typeLabel = notificationTypeLabel(n);

    const footer = (
      <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100">
        {unread ? (
          <button
            onClick={guard(() => markRead(n.id))}
            className="text-xs font-bold text-[#6D28D9] hover:text-violet-800 cursor-pointer"
          >
            Marquer comme lu
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
            <CheckCircle className="w-3.5 h-3.5" /> Lue
          </span>
        )}
        <div className="flex items-center gap-1.5">
          <button
            onClick={guard(() => togglePin(n.id))}
            title={pinned ? "Désépingler" : "Épingler"}
            aria-label={pinned ? "Désépingler la notification" : "Épingler la notification"}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              pinned
                ? "border-[#6D28D9] bg-violet-50 text-[#6D28D9] hover:bg-violet-100"
                : "border-gray-200 text-gray-400 hover:border-violet-200 hover:text-violet-700"
            }`}
          >
            {pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={guard(() => hideNotification(n.id))}
            title="Masquer"
            aria-label="Masquer la notification"
            className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-600 transition-colors cursor-pointer"
          >
            <EyeOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );

    const body = (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className="px-2.5 py-1 rounded-full bg-violet-50 text-[#6D28D9] text-xs font-bold whitespace-nowrap">
            {typeLabel}
          </span>
          {pinned && (
            <span title="Notification épinglée">
              <Pin className="w-4 h-4 text-[#6D28D9] fill-current" />
            </span>
          )}
        </div>
        <p
          className={`text-sm leading-snug ${unread ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}
        >
          {title}
        </p>
        {message && message !== title && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{message}</p>
        )}
        <p className="text-xs text-gray-400 mt-auto pt-2.5">
          {formatNotificationDate(n.created_at)}
        </p>
        {footer}
      </div>
    );

    const cardCls = `p-4 rounded-xl border shadow-xs transition-all ${
      unread ? "bg-violet-50/50 border-violet-100" : "bg-white border-gray-150"
    }`;

    // Carte cliquable (demandes) : le clic marque la notification comme lue.
    return href ? (
      <Link
        key={n.id}
        href={href}
        onClick={() => {
          if (unread) markRead(n.id);
        }}
        className={`${cardCls} hover:border-violet-200 hover:shadow-md`}
      >
        {body}
      </Link>
    ) : (
      <div key={n.id} className={cardCls}>
        {body}
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
    <div className="max-w-5xl mx-auto px-4 py-8">
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
          <div className="flex items-center justify-between gap-3 mb-4 pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Boîte de réception</h3>
              <p className="text-sm text-gray-500">
                {meta ? `${meta.total} notification${meta.total > 1 ? "s" : ""}` : "…"}
                {unreadCount > 0
                  ? ` · ${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`
                  : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Bascule vue cartes / tableau — même pattern que le dashboard. */}
              <div
                className="hidden sm:flex bg-gray-100 rounded-lg p-0.5"
                role="group"
                aria-label="Mode d'affichage"
              >
                <button
                  onClick={() => setViewMode("cards")}
                  className={`p-1.5 rounded-md transition-all cursor-pointer ${
                    viewMode === "cards"
                      ? "bg-white shadow-xs text-black"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                  aria-label="Afficher en cartes"
                  title="Vue cartes"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded-md transition-all cursor-pointer ${
                    viewMode === "table"
                      ? "bg-white shadow-xs text-black"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                  aria-label="Afficher en tableau"
                  title="Vue tableau"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1.5 text-xs font-bold text-[#6D28D9] border border-violet-200 bg-violet-50 hover:bg-violet-100 px-3 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  <CheckCheck className="w-4 h-4" /> Tout marquer comme lu
                </button>
              )}
            </div>
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
            <>
              {/* Vue tableau (sm+) : table-fixed, aucun scroll horizontal. */}
              <div className={`${viewMode === "table" ? "hidden sm:block" : "hidden"}`}>
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="border-b border-gray-100 text-xs uppercase font-bold text-gray-500">
                    <tr>
                      <th className="px-4 py-3 w-[46%]">Titre de notification</th>
                      <th className="px-4 py-3 w-[17%]">Date</th>
                      <th className="px-4 py-3 w-[19%]">Type</th>
                      <th className="px-4 py-3 w-[18%] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {notifications.map(renderRow)}
                  </tbody>
                </table>
              </div>

              {/* Vue cartes : grille 2 à 3 par ligne. Comme sur le dashboard,
                  les cartes restent visibles sur mobile même en mode tableau. */}
              <div
                className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${
                  viewMode === "cards" ? "" : "sm:hidden"
                } ${isFetching ? "opacity-60 transition-opacity" : ""}`}
              >
                {notifications.map(renderCard)}
              </div>
            </>
          )}
        </div>

        {/* Pagination fenêtrée — style dashboard (boutons bordés). */}
        {lastPage > 1 && (
          <div className="flex justify-center items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center px-3 py-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 cursor-pointer transition-colors"
              aria-label="Page précédente"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5">
              {pageWindow(page, lastPage).map((p, i) =>
                p === "…" ? (
                  <span key={`gap-${i}`} className="px-1 text-xs text-gray-400">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-3 py-2 border rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                      p === page
                        ? "border-[#6D28D9] bg-[#6D28D9] text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              disabled={page >= lastPage}
              className="flex items-center px-3 py-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 cursor-pointer transition-colors"
              aria-label="Page suivante"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {toast && <Toast message={toast} />}
    </div>
  );
}
