"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import SmartCoverImage from "@/components/SmartCoverImage";
import { slugify } from "@/lib/listings-api";
import {
  Users,
  BookOpen,
  Settings2,
  Search,
  CheckCircle2,
  Ban,
  Trash2,
  Play,
  Save,
  ChevronLeft,
  ChevronRight,
  Lock,
  Pause,
  Plus,
  Pencil,
  Loader2,
} from "lucide-react";
import api from "@/lib/axios";
import { getApiErrorMessage } from "@/lib/api-error";
import ToastContainer, { ToastData, ToastType } from "@/components/Toast";
import SortableTh from "@/components/SortableTh";
import { useDebounced } from "@/hooks/useDebounced";
import ConfirmDialog from "@/components/ConfirmDialog";

const PAGE_SIZE = 15;

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface AdminUser {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
  is_active: boolean;
  profile: {
    nickname?: string | null;
    logo?: string | null;
    subscription_type?: string | null;
    paused_from_type?: string | null;
    paused_at?: string | null;
  } | null;
  listings_count: number;
  last_login_at?: string | null;
  connection: {
    online: boolean;
    last_activity: number | null;
    last_ip: string | null;
    active_sessions: number;
  };
  created_at: string;
}

interface AdminListing {
  id: number;
  user_id?: number;
  title: string;
  isbn_13?: string | null;
  price: number;
  discount_price?: number | null;
  status: string;
  created_at: string;
  cover_path?: string | null;
  cover_url?: string | null;
  cover_thumbnail_url?: string | null;
  cover_source_url?: string | null;
  book?: { cover_url?: string | null } | null;
  category?: { name_fr: string } | null;
  user?: { profile?: { nickname?: string | null } | null } | null;
}

interface HeroMessage {
  id?: number;
  language: "fr" | "ar";
  direction: "ltr" | "rtl";
  title: string;
  description: string;
  primaryAction: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
}

interface AdminClientProps {
  user: { id: number; name: string; email: string; is_admin: boolean };
  initialTab?: "users" | "listings" | "hero";
  initialListingsFilter?: string;
  /** Mode page dédiée : masque l'en-tête et la barre d'onglets internes (navigation gérée par l'AdminShell). */
  singleTab?: boolean;
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function formatDate(value?: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("fr-FR");
  } catch {
    return "—";
  }
}

function getAvatarUrl(p?: AdminUser["profile"]): string | null {
  if (!p?.logo) return null;
  if (p.logo.startsWith("http")) return p.logo;
  return `https://api-next.livrezone.com${p.logo}`;
}

// Chemin de la page listing-details publique d'une annonce — même convention
// d'URL que le reste du site (/{nickname}/{id}-{isbn}-{titre-slugifié}).
function listingDetailPath(l: AdminListing): string {
  const nickname = l.user?.profile?.nickname || `utilisateur-${l.user_id ?? "?"}`;
  const isbn = l.isbn_13 || "livre";
  return `/${nickname}/${l.id}-${isbn}-${slugify(l.title)}`;
}

export default function AdminClient({
  user,
  initialTab = "users",
  initialListingsFilter = "all",
  singleTab = false,
}: AdminClientProps) {
  const [activeTab, setActiveTab] = useState<"users" | "listings" | "hero">(initialTab);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const toastIdRef = useRef(0);

  const pushToast = (message: string, type: ToastType = "success") => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 260);
    }, 3200);
  };

  const dismissToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const tabs = [
    { val: "users", label: "Utilisateurs", icon: Users },
    { val: "listings", label: "Annonces", icon: BookOpen },
    { val: "hero", label: "Hero", icon: Settings2 },
  ];

  return (
    <div className="space-y-10 font-sans">
      {!singleTab && (
        <>
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-between border-b border-gray-100 pb-5">
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-0.5">Administration</p>
              <h1 className="text-2xl font-black text-gray-950 leading-tight">Espace administrateur</h1>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Connecté en tant que {user.name} · {user.email}
              </p>
            </div>
          </div>

          <div className="flex bg-gray-100 rounded-lg p-0.5 w-full">
            {tabs.map((tab) => (
              <button
                key={tab.val}
                onClick={() => setActiveTab(tab.val as typeof activeTab)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  activeTab === tab.val ? "bg-white shadow-xs text-black" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </>
      )}

      {activeTab === "users" && <UsersTab pushToast={pushToast} currentUserId={user.id} />}
      {activeTab === "listings" && <ListingsTab pushToast={pushToast} initialFilter={initialListingsFilter} />}
      {activeTab === "hero" && <HeroTab pushToast={pushToast} />}

      <ToastContainer toasts={toasts} dismiss={dismissToast} />
    </div>
  );
}

// ==================================================================
// Onglet Utilisateurs
// ==================================================================

function UsersTab({ pushToast, currentUserId }: { pushToast: (m: string, t?: ToastType) => void; currentUserId?: number }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [status, setStatus] = useState("all");
  const [connection, setConnection] = useState("all");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());

  // Repasse à la page 1 quand la recherche stabilisée change
  const [lastSearchKey, setLastSearchKey] = useState(debouncedSearch);
  if (lastSearchKey !== debouncedSearch) {
    setLastSearchKey(debouncedSearch);
    setPage(1);
  }

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
    setPage(1);
  };

  const subscriptionMutation = useMutation({
    mutationFn: async ({ id, type }: { id: number; type: string }) => {
      const { data } = await api.post(`/admin/users/${id}/subscription`, { subscription_type: type });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  const changeSubscription = (id: number, type: string) => {
    if (pendingIds.has(id)) return;
    setPendingIds((prev) => new Set(prev).add(id));
    subscriptionMutation
      .mutateAsync({ id, type })
      .then((res) => pushToast(res?.message || "Profil d'abonnement mis à jour"))
      .catch((e) => pushToast(getApiErrorMessage(e, "Erreur lors de la mise à jour."), "warning"))
      .finally(() => {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      });
  };

  const params: Record<string, string | number> = {
    limit: PAGE_SIZE,
    page,
    sort_by: sortBy,
    sort_dir: sortDir,
  };
  if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
  if (status !== "all") params.status = status;
  if (connection !== "all") params.connection = connection;
  if (type !== "all") params.type = type;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "users", params],
    queryFn: async () => {
      const { data } = await api.get("/admin/users", { params });
      return data;
    },
    placeholderData: keepPreviousData,
  });

  const meta = data?.meta;
  const users: AdminUser[] = data?.users ?? [];
  const totalPages = Math.max(1, meta?.last_page ?? 1);

  const statusMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) => {
      const { data } = await api.post(`/admin/users/${id}/status`, { is_active });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "listings"] });
    },
  });

  const toggleUser = (id: number, isActive: boolean) => {
    if (pendingIds.has(id)) return;
    setPendingIds((prev) => new Set(prev).add(id));
    statusMutation
      .mutateAsync({ id, is_active: !isActive })
      .then((res) => pushToast(res?.message || "Statut mis à jour"))
      .catch((e) => pushToast(getApiErrorMessage(e, "Erreur lors de la mise à jour."), "warning"))
      .finally(() => {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      });
  };

  // Désactivation utilisateur : confirmation préalable (action impactante).
  const [confirmDeactivate, setConfirmDeactivate] = useState<{ id: number; name: string } | null>(null);

  // Pause / reprise d'abonnement
  const [confirmPause, setConfirmPause] = useState<{ id: number; name: string } | null>(null);
  const [pausePendingId, setPausePendingId] = useState<number | null>(null);

  const togglePause = async (id: number, name: string, pause: boolean) => {
    if (pausePendingId !== null) return;
    setPausePendingId(id);
    try {
      const res = await api.post(`/admin/users/${id}/subscription/${pause ? "pause" : "resume"}`);
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      pushToast(res?.data?.message || "Abonnement mis à jour");
    } catch (e) {
      pushToast(getApiErrorMessage(e, "Erreur lors de la modification de l'abonnement."), "warning");
    } finally {
      setPausePendingId(null);
    }
  };

  const requestToggle = (id: number, name: string, isActive: boolean) => {
    if (isActive) {
      setConfirmDeactivate({ id, name });
    } else {
      toggleUser(id, isActive);
    }
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={confirmPause !== null}
        title="Mettre l'abonnement en pause ?"
        message={
          confirmPause
            ? `${confirmPause.name} repassera en plan gratuit et ses annonces excédentaires seront masquées. L'offre d'origine sera mémorisée pour une reprise ultérieure.`
            : ""
        }
        confirmLabel="Mettre en pause"
        danger
        onConfirm={() => {
          if (confirmPause) togglePause(confirmPause.id, confirmPause.name, true);
          setConfirmPause(null);
        }}
        onCancel={() => setConfirmPause(null)}
      />
      <ConfirmDialog
        open={confirmDeactivate !== null}
        title="Désactiver cet utilisateur ?"
        message={
          confirmDeactivate
            ? `${confirmDeactivate.name} ne pourra plus se connecter ni publier. Toutes ses annonces en ligne seront masquées ; sa réactivation les remettra automatiquement en ligne.`
            : ""
        }
        confirmLabel="Désactiver"
        cancelLabel="Annuler"
        danger
        onConfirm={() => {
          if (confirmDeactivate) toggleUser(confirmDeactivate.id, true);
          setConfirmDeactivate(null);
        }}
        onCancel={() => setConfirmDeactivate(null)}
      />
      <div className="flex flex-col sm:flex-row md:items-center justify-between gap-3">
        <div className="flex gap-2">
          {[
            { label: "Tous", val: "all" },
            { label: "Actifs", val: "active" },
            { label: "Désactivés", val: "inactive" },
          ].map((opt) => (
            <button
              key={opt.val}
              onClick={() => { setStatus(opt.val); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                status === opt.val ? "bg-[#6D28D9] text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <select
            value={type}
            onChange={(e) => { setType(e.target.value); setPage(1); }}
            className="text-xs border border-gray-200 bg-white rounded-lg py-2 px-2 pr-6 text-gray-600 shadow-xs cursor-pointer"
          >
            <option value="all">Tous les comptes</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="premium">Premium</option>
          </select>

          <select
            value={connection}
            onChange={(e) => { setConnection(e.target.value); setPage(1); }}
            className="text-xs border border-gray-200 bg-white rounded-lg py-2 px-2 pr-6 text-gray-600 shadow-xs cursor-pointer"
          >
            <option value="all">Toutes connexions</option>
            <option value="online">En ligne</option>
            <option value="offline">Hors ligne</option>
          </select>

          <div className="relative border border-gray-200 rounded-lg overflow-hidden bg-white shadow-xs">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Rechercher..."
              className="w-full text-xs border-none bg-transparent py-2 pl-8 pr-3 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {meta && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: meta.total ?? "—", cls: "text-gray-900" },
            { label: "Actifs", value: meta.active_count ?? "—", cls: "text-emerald-600" },
            { label: "Désactivés", value: meta.inactive_count ?? "—", cls: "text-rose-500" },
            { label: "En ligne", value: meta.online_count ?? "—", cls: "text-[#6D28D9]" },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-150 shadow-xs px-4 py-3 flex flex-col justify-center">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{s.label}</span>
              <span className={`text-2xl font-black leading-none ${s.cls}`}>{s.value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-gray-400">Chargement des utilisateurs...</div>
        ) : isError ? (
          <div className="py-16 text-center text-sm text-rose-500">Impossible de charger les utilisateurs.</div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">Aucun utilisateur trouvé.</div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-gray-50 border-b border-gray-150 text-gray-500 uppercase text-[10px] font-bold">
              <tr>
                <SortableTh label="Utilisateur" field="name" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Connexion</th>
                <SortableTh label="Dernière connexion" field="last_activity" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <th className="px-4 py-3 text-center">Annonces</th>
                <th className="px-4 py-3">Abonnement</th>
                <SortableTh label="Inscrit" field="created_at" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <th className="px-4 py-3 text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => {
                const avatar = getAvatarUrl(u.profile);
                const busy = pendingIds.has(u.id);
                return (
                  <tr key={u.id} className="hover:bg-violet-50/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#6D28D9] text-white flex items-center justify-center text-xs font-black overflow-hidden flex-shrink-0">
                          {avatar ? (
                            <img src={avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            (u.name || "?").charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-bold text-gray-950 truncate">
                            <Link
                              href={`/admin/utilisateurs/${u.id}`}
                              className="hover:text-[#6D28D9] transition-colors"
                              title="Voir la fiche de l'utilisateur"
                            >
                              {u.name}
                            </Link>
                            {u.is_admin && (
                              <span className="text-[8px] bg-violet-600 text-white font-bold px-1.5 py-0.5 rounded-sm uppercase">Admin</span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400 block truncate">{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.is_active ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">Actif</span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border bg-rose-50 text-rose-700 border-rose-200">Désactivé</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${u.connection?.online ? "bg-emerald-400" : "bg-gray-300"}`}></span>
                        <span className="text-[11px] font-bold text-gray-700">{u.connection?.online ? "En ligne" : "Hors ligne"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(u.last_login_at)}
                    </td>
                    <td className="px-4 py-3 text-center">{u.listings_count}</td>
                    <td className="px-4 py-3">
                      {u.id === currentUserId ? (
                        <span className="text-[10px] text-gray-400">—</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <select
                            value={u.profile?.subscription_type ?? "free"}
                            disabled={pendingIds.has(u.id)}
                            onChange={(e) => changeSubscription(u.id, e.target.value)}
                            className="text-[11px] border border-gray-200 bg-white rounded-lg py-1.5 px-2 text-gray-600 shadow-xs cursor-pointer disabled:opacity-50"
                            title="Changer le profil d'abonnement"
                          >
                            <option value="free">Gratuit</option>
                            <option value="pro">Pro</option>
                            <option value="premium">Premium</option>
                          </select>
                          {pausePendingId === u.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-[#6D28D9]" />
                          ) : u.profile?.paused_from_type ? (
                            <button
                              onClick={() => togglePause(u.id, u.name, false)}
                              className="p-1.5 rounded-lg transition-colors cursor-pointer text-emerald-600 hover:bg-emerald-50"
                              title={`Reprendre l'abonnement ${u.profile.paused_from_type.toUpperCase()}`}
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          ) : (u.profile?.subscription_type ?? "free") !== "free" ? (
                            <button
                              onClick={() => setConfirmPause({ id: u.id, name: u.name })}
                              className="p-1.5 rounded-lg transition-colors cursor-pointer text-orange-500 hover:bg-orange-50"
                              title="Mettre l'abonnement en pause"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-right pr-4">
                      <div className="flex gap-1.5 justify-end items-center">
                        <button
                          onClick={() => requestToggle(u.id, u.name, u.is_active)}
                          disabled={busy}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                            u.is_active
                              ? "text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                              : "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                          }`}
                          title={u.is_active ? "Désactiver l'utilisateur" : "Activer l'utilisateur"}
                        >
                          {u.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        </button>
                        <button
                          className="p-1.5 text-gray-300 opacity-60 cursor-not-allowed"
                          title="Réinitialisation du mot de passe : bientôt disponible"
                          disabled
                        >
                          <Lock className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}
    </div>
  );
}

// ==================================================================
// Onglet Annonces
// ==================================================================

function ListingsTab({ pushToast, initialFilter = "all" }: { pushToast: (m: string, t?: ToastType) => void; initialFilter?: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [filter, setFilter] = useState(initialFilter);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [confirmAction, setConfirmAction] = useState<{
    scope: "single" | "bulk";
    id?: number;
    action: string;
  } | null>(null);

  const ACTION_LABELS: Record<string, string> = {
    activate: "Activer",
    deactivate: "Désactiver",
    delete: "Supprimer",
  };

  const runConfirmed = () => {
    if (!confirmAction) return;
    if (confirmAction.scope === "single" && confirmAction.id !== undefined) {
      handleSingle(confirmAction.id, confirmAction.action);
    } else {
      handleBulk(confirmAction.action);
    }
    setConfirmAction(null);
  };

  // Repasse à la page 1 quand la recherche stabilisée change
  const [lastSearchKey, setLastSearchKey] = useState(debouncedSearch);
  if (lastSearchKey !== debouncedSearch) {
    setLastSearchKey(debouncedSearch);
    setPage(1);
  }

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
    setPage(1);
  };

  const params: Record<string, string | number> = {
    limit: PAGE_SIZE,
    page,
    sort_by: sortBy,
    sort_dir: sortDir,
  };
  if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
  if (filter !== "all") params.filter = filter;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "listings", params],
    queryFn: async () => {
      const { data } = await api.get("/admin/listings", { params });
      return data;
    },
    placeholderData: keepPreviousData,
  });

  const meta = data?.meta;
  const listings: AdminListing[] = data?.listings ?? [];
  const totalPages = Math.max(1, meta?.last_page ?? 1);

  const singleMutation = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: string }) => {
      const { data } = await api.post(`/admin/listings/${id}/status`, { action });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "listings"] }),
  });

  const bulkMutation = useMutation({
    mutationFn: async ({ action }: { action: string }) => {
      const { data } = await api.post("/admin/listings/bulk-status", { ids: selectedIds, action });
      return data;
    },
    onSuccess: () => {
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ["admin", "listings"] });
    },
  });

  const handleSingle = (id: number, action: string) => {
    if (busyIds.has(id)) return;
    setBusyIds((prev) => new Set(prev).add(id));
    singleMutation
      .mutateAsync({ id, action })
      .then((res) => pushToast(res?.message || "Annonce mise à jour"))
      .catch((e) => pushToast(getApiErrorMessage(e, "Erreur lors de la mise à jour."), "warning"))
      .finally(() => {
        setBusyIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      });
  };

  const handleBulk = (action: string) => {
    if (selectedIds.length === 0) return;
    bulkMutation
      .mutateAsync({ action })
      .then((res) => pushToast(res?.message || "Annonces mises à jour"))
      .catch((e) => pushToast(getApiErrorMessage(e, "Erreur lors de la mise à jour."), "warning"));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === listings.length) setSelectedIds([]);
    else setSelectedIds(listings.map((l) => l.id));
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const statusBadge = (l: AdminListing) => {
    switch (l.status) {
      case "published":
      case "active":
        return { label: "En ligne", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
      case "pending_admin":
        return { label: "En attente", className: "bg-amber-50 text-amber-700 border-amber-200" };
      case "deleted":
        return { label: "Supprimé", className: "bg-rose-50 text-rose-700 border-rose-200" };
      case "archived":
        return { label: "Archivé", className: "bg-gray-100 text-gray-500 border-gray-200" };
      case "hidden":
      case "expired":
        return { label: "Hors ligne", className: "bg-gray-100 text-gray-500 border-gray-200" };
      case "sold":
        return { label: "Vendu", className: "bg-gray-100 text-gray-600 border-gray-200" };
      default:
        return { label: l.status, className: "bg-gray-100 text-gray-500 border-gray-200" };
    }
  };

  const coverUrl = (l: AdminListing) =>
    l.cover_thumbnail_url || l.cover_url || l.book?.cover_url || l.cover_source_url || null;

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={confirmAction !== null}
        title={
          confirmAction?.action === "delete"
            ? confirmAction.scope === "bulk"
              ? `Supprimer ${selectedIds.length} annonces ?`
              : "Supprimer cette annonce ?"
            : `${ACTION_LABELS[confirmAction?.action ?? ""] ?? "Modifier"} ${confirmAction?.scope === "bulk" ? `${selectedIds.length} annonces` : "cette annonce"} ?`
        }
        message={
          confirmAction?.action === "delete"
            ? "L'annonce sera retirée de la plateforme et ne pourra plus être récupérée par l'acheteur."
            : "L'annonce deviendra invisible publiquement. Le vendeur pourra la réactiver."
        }
        confirmLabel={ACTION_LABELS[confirmAction?.action ?? ""] ?? "Confirmer"}
        danger={confirmAction?.action === "delete"}
        onConfirm={runConfirmed}
        onCancel={() => setConfirmAction(null)}
      />
      <div className="flex flex-col sm:flex-row md:items-center justify-between gap-4">
        <div className="flex bg-gray-100 rounded-lg p-0.5 flex-wrap">
          {[
            { val: "all", label: "Tout" },
            { val: "online", label: "En ligne" },
            { val: "offline", label: "Hors ligne" },
            { val: "pending", label: "En attente" },
            { val: "archived", label: "Archivé" },
            { val: "deleted", label: "Supprimé" },
          ].map((opt) => (
            <button
              key={opt.val}
              onClick={() => { setFilter(opt.val); setSelectedIds([]); setPage(1); }}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                filter === opt.val ? "bg-white shadow-xs text-black" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {opt.label}
              {meta?.status_counts?.[opt.val] != null && opt.val !== "all" && (
                <span className="ml-1 text-[10px] text-gray-400">({meta.status_counts[opt.val]})</span>
              )}
            </button>
          ))}
        </div>

        <div className="relative border border-gray-200 rounded-lg overflow-hidden bg-white shadow-xs">
          <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Rechercher (titre, ISBN, vendeur)..."
            className="w-full text-xs border-none bg-transparent py-2 pl-8 pr-3 focus:outline-none"
          />
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="bg-[#6D28D9]/5 border border-[#6D28D9]/20 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded bg-[#6D28D9] text-white text-xs font-bold">
              {selectedIds.length}
            </span>
            <span className="text-xs font-bold text-[#6D28D9]">Annonces sélectionnées</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setConfirmAction({ scope: "bulk", action: "activate" })}
              disabled={bulkMutation.isPending}
              className="flex items-center gap-1.5 text-xs font-bold bg-white text-emerald-600 hover:bg-emerald-50 border border-gray-200 px-3 py-2 rounded-lg transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" /> Activer
            </button>
            <button
              onClick={() => setConfirmAction({ scope: "bulk", action: "deactivate" })}
              disabled={bulkMutation.isPending}
              className="flex items-center gap-1.5 text-xs font-bold bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 px-3 py-2 rounded-lg transition-colors cursor-pointer"
            >
              <Ban className="w-3.5 h-3.5" /> Désactiver
            </button>
            <button
              onClick={() => setConfirmAction({ scope: "bulk", action: "delete" })}
              disabled={bulkMutation.isPending}
              className="flex items-center gap-1.5 text-xs font-bold bg-white text-rose-600 hover:bg-rose-50 border border-gray-200 px-3 py-2 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Supprimer
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-gray-400">Chargement des annonces...</div>
        ) : isError ? (
          <div className="py-16 text-center text-sm text-rose-500">Impossible de charger les annonces.</div>
        ) : listings.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">Aucune annonce trouvée.</div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-gray-50 border-b border-gray-150 text-gray-500 uppercase text-[10px] font-bold">
              <tr>
                <th className="px-4 py-3 w-8">
                  <input type="checkbox" checked={selectedIds.length === listings.length && listings.length > 0} onChange={toggleSelectAll} className="rounded border-gray-300 text-[#6D28D9] focus:ring-[#6D28D9] cursor-pointer" />
                </th>
                <SortableTh label="Annonce" field="title" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <th className="px-4 py-3">Vendeur</th>
                <SortableTh label="Prix" field="price" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <th className="px-4 py-3">Statut</th>
                <SortableTh label="Date" field="created_at" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <th className="px-4 py-3 text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {listings.map((l) => {
                const b = statusBadge(l);
                const cover = coverUrl(l);
                const busy = busyIds.has(l.id);
                return (
                  <tr key={l.id} className={`hover:bg-violet-50/20 transition-colors ${selectedIds.includes(l.id) ? "bg-violet-50/30" : ""}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedIds.includes(l.id)} onChange={() => toggleSelect(l.id)} className="rounded border-gray-300 text-[#6D28D9] focus:ring-[#6D28D9] cursor-pointer" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Link
                          href={listingDetailPath(l)}
                          title="Voir la fiche de l'annonce"
                          className="w-8 h-11 flex-shrink-0 bg-gray-50 rounded border border-gray-150 overflow-hidden flex items-center justify-center relative hover:border-[#6D28D9]/40 transition-colors cursor-pointer"
                        >
                          {cover ? (
                            <SmartCoverImage src={cover} alt={l.title} className="object-contain" sizes="32px" />
                          ) : (
                            <BookOpen className="w-4 h-4 text-gray-300" />
                          )}
                        </Link>
                        <div className="min-w-0">
                          <Link
                            href={listingDetailPath(l)}
                            title="Voir la fiche de l'annonce"
                            className="font-bold text-gray-950 text-xs truncate hover:text-[#6D28D9] hover:underline block cursor-pointer"
                          >
                            {l.title}
                          </Link>
                          <span className="text-[10px] text-gray-400 block truncate">ISBN : {l.isbn_13 || "N/A"}</span>
                          {l.category && (
                            <span className="text-[10px] text-violet-500 font-bold block">{l.category.name_fr}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{l.user?.profile?.nickname || `utilisateur-${l.user_id ?? "?"}`}</td>
                    <td className="px-4 py-3">
                      {l.discount_price ? (
                        <div>
                          <span className="text-[10px] text-gray-400 line-through mr-1">{Number(l.price).toFixed(2)}</span>
                          <span className="font-bold text-[#6D28D9] text-xs">{Number(l.discount_price).toFixed(2)} MAD</span>
                        </div>
                      ) : (
                        <span className="font-bold text-gray-900 text-xs">{Number(l.price).toFixed(2)} MAD</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${b.className}`}>{b.label}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{formatDate(l.created_at)}</td>
                    <td className="px-4 py-3 text-right pr-4">
                      <div className="flex gap-1.5 justify-end items-center">
                        <Link
                          href={`/admin/annonces/${l.id}/edit`}
                          className="p-1.5 text-[#6D28D9] hover:bg-violet-50 hover:text-violet-800 transition-colors"
                          title="Modifier l'annonce"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Link>
                        <button onClick={() => handleSingle(l.id, "activate")} disabled={busy} className="p-1.5 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors cursor-pointer" title="Activer">
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setConfirmAction({ scope: "single", id: l.id, action: "deactivate" })} disabled={busy} className="p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer" title="Désactiver">
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setConfirmAction({ scope: "single", id: l.id, action: "delete" })} disabled={busy} className="p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer" title="Supprimer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}
    </div>
  );
}

// ==================================================================
// Onglet Hero
// ==================================================================

function HeroTab({ pushToast }: { pushToast: (m: string, t?: ToastType) => void }) {
  // Édition locale uniquement : les données serveur sont dérivées au rendu
  // (pas de synchronisation state <-> props dans un effet).
  const [overrides, setOverrides] = useState<HeroMessage[] | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "hero-file"],
    queryFn: async () => {
      const res = await fetch("/api/hero-messages", { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    },
  });

  const serverMessages = (data?.messages as HeroMessage[] | undefined) ?? [];
  const messages: HeroMessage[] = overrides ??
    (isLoading ? [] : (serverMessages.length > 0 ? serverMessages : [newBlankMessage(1)]));

  const updateField = <K extends keyof HeroMessage>(index: number, key: K, value: HeroMessage[K]) => {
    const next = [...messages];
    next[index] = { ...next[index], [key]: value };
    setOverrides(next);
  };

  const updateNested = (
    index: number,
    kind: "primaryAction" | "secondaryAction",
    field: "label" | "href",
    value: string
  ) => {
    const next = [...messages];
    const msg = { ...next[index] };
    const action = msg[kind] ? { ...msg[kind] } : { label: "", href: "" };
    (action as Record<string, string>)[field] = value;
    (msg as Record<string, unknown>)[kind] = action;
    next[index] = msg as HeroMessage;
    setOverrides(next);
  };

  const addMessage = () => {
    const maxId = messages.reduce((m, x) => Math.max(m, x.id ?? 0), 0);
    setOverrides([...messages, newBlankMessage(maxId + 1)]);
  };

  const removeMessage = (index: number) => {
    const next = [...messages];
    next.splice(index, 1);
    setOverrides(next.length > 0 ? next : [newBlankMessage(1)]);
  };

  const saveMutation = useMutation({
    mutationFn: async (list: HeroMessage[]) => {
      const res = await fetch("/api/hero-messages", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ messages: list }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "HTTP " + res.status);
      return json;
    },
    onSuccess: (res) => pushToast(res?.message || "Messages du hero enregistrés."),
  });

  const handleSave = () => {
    if (!messages || messages.length === 0) return;
    saveMutation.mutate(messages);
  };

  const list = messages ?? [];
  const anyInvalid = list.some((m) => !m.title.trim() || !m.description.trim());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-gray-950">Messages du hero</h2>
          <p className="text-xs text-gray-500 mt-1">
            Enregistré dans <code className="text-[10px]">data/hero-messages.json</code>. Jusqu&rsquo;à 3
            messages sont sélectionnés aléatoirement sur la page d&rsquo;accueil.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={addMessage}
            className="flex items-center gap-1.5 border border-gray-200 bg-white text-gray-700 font-bold px-3 py-2 rounded-lg text-xs hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Ajouter
          </button>
          <button
            onClick={handleSave}
            disabled={anyInvalid || saveMutation.isPending}
            className="flex items-center gap-1.5 bg-[#6D28D9] text-white font-bold px-4 py-2 rounded-lg text-xs hover:bg-violet-800 transition-all shadow-xs disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" /> Enregistrer
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-sm text-gray-400">Chargement...</div>
      ) : isError ? (
        <div className="py-10 text-center text-sm text-rose-500">Impossible de charger les messages.</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-gray-50 border-b border-gray-150 text-gray-500 uppercase text-[10px] font-bold">
              <tr>
                <th className="px-3 py-2 w-16">Langue</th>
                <th className="px-3 py-2">Titre</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Action principale</th>
                <th className="px-3 py-2">Action secondaire</th>
                <th className="px-3 py-2 text-right pr-3 w-10">Suppr.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.map((m, i) => (
                <tr key={m.id ?? i} className="align-top">
                  <td className="px-3 py-2">
                    <select
                      value={m.language}
                      onChange={(e) => updateField(i, "language", e.target.value as HeroMessage["language"])}
                      className="text-[11px] border border-gray-200 bg-white rounded-lg py-1.5 px-2 text-gray-600 shadow-xs cursor-pointer w-full"
                    >
                      <option value="fr">FR</option>
                      <option value="ar">AR</option>
                    </select>
                    <select
                      value={m.direction}
                      onChange={(e) => updateField(i, "direction", e.target.value as HeroMessage["direction"])}
                      className="text-[11px] border border-gray-200 bg-white rounded-lg py-1.5 px-2 text-gray-600 shadow-xs cursor-pointer w-full mt-1"
                    >
                      <option value="ltr">LTR</option>
                      <option value="rtl">RTL</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <textarea
                      value={m.title}
                      onChange={(e) => updateField(i, "title", e.target.value)}
                      rows={2}
                      className="w-full text-[11px] border border-gray-200 bg-white rounded-lg py-1.5 px-2 resize-y"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <textarea
                      value={m.description}
                      onChange={(e) => updateField(i, "description", e.target.value)}
                      rows={3}
                      className="w-full text-[11px] border border-gray-200 bg-white rounded-lg py-1.5 px-2 resize-y"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={m.primaryAction?.label ?? ""}
                      onChange={(e) => updateNested(i, "primaryAction", "label", e.target.value)}
                      placeholder="Libellé"
                      className="w-full text-[11px] border border-gray-200 bg-white rounded-lg py-1.5 px-2"
                    />
                    <input
                      value={m.primaryAction?.href ?? ""}
                      onChange={(e) => updateNested(i, "primaryAction", "href", e.target.value)}
                      placeholder="Lien"
                      className="w-full text-[11px] border border-gray-200 bg-white rounded-lg py-1.5 px-2 mt-1"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={m.secondaryAction?.label ?? ""}
                      onChange={(e) => updateNested(i, "secondaryAction", "label", e.target.value)}
                      placeholder="Libellé"
                      className="w-full text-[11px] border border-gray-200 bg-white rounded-lg py-1.5 px-2"
                    />
                    <input
                      value={m.secondaryAction?.href ?? ""}
                      onChange={(e) => updateNested(i, "secondaryAction", "href", e.target.value)}
                      placeholder="Lien"
                      className="w-full text-[11px] border border-gray-200 bg-white rounded-lg py-1.5 px-2 mt-1"
                    />
                  </td>
                  <td className="px-3 py-2 text-right pr-4">
                    <button
                      onClick={() => removeMessage(i)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Supprimer le message"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {anyInvalid && (
        <div className="text-xs text-rose-500 font-bold">
          Titre et description sont obligatoires pour chaque message.
        </div>
      )}
    </div>
  );
}

function newBlankMessage(id: number): HeroMessage {
  return {
    id,
    language: "fr",
    direction: "ltr",
    title: "",
    description: "",
    primaryAction: { label: "", href: "/annonces" },
  };
}

// ==================================================================
// Pagination
// ==================================================================

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (n: number) => void }) {
  return (
    <div className="flex justify-center items-center gap-2">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 cursor-pointer transition-colors"
        aria-label="Page précédente"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`px-3 py-2 border rounded-lg font-bold text-xs transition-colors cursor-pointer ${
              n === page ? "border-[#6D28D9] bg-[#6D28D9] text-white" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 cursor-pointer transition-colors"
        aria-label="Page suivante"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}