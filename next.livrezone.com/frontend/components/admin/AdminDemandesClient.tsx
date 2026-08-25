"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  PackageCheck,
  Search,
  XCircle,
} from "lucide-react";
import api from "@/lib/axios";

interface AdminOrder {
  id: number;
  title: string;
  author: string | null;
  isbn: string | null;
  cover_url: string | null;
  status: string;
  comment: string | null;
  category: string | null;
  user: { id: number; email: string; nickname: string | null } | null;
  created_at: string | null;
}

type ToastType = "success" | "error" | "info" | "warning";
interface ToastData {
  id: number;
  message: string;
  type: ToastType;
  leaving?: boolean;
}

const STATUS_TABS = [
  { val: "all", label: "Toutes" },
  { val: "pending_admin", label: "En attente" },
  { val: "published", label: "Publiées" },
  { val: "fulfilled", label: "Satisfaites" },
  { val: "rejected", label: "Rejetées" },
] as const;

const STATUS_STYLES: Record<string, string> = {
  pending_admin: "bg-amber-50 text-amber-700 border-amber-200",
  published: "bg-emerald-50 text-emerald-700 border-emerald-200",
  fulfilled: "bg-violet-50 text-[#6D28D9] border-violet-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
};

const PAGE_SIZE = 20;

export default function AdminDemandesClient() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);
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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await api.get("/admin/orders", {
          params: {
            status,
            search: search || undefined,
            sort_by: sortBy,
            sort_dir: sortDir,
            limit: PAGE_SIZE,
            page,
          },
        });
        if (!cancelled) {
          setOrders(res.data.orders ?? []);
          setStatusCounts(res.data.meta?.status_counts ?? {});
          setTotal(res.data.meta?.total ?? 0);
          setLastPage(res.data.meta?.last_page ?? 1);
        }
      } catch {
        if (!cancelled) pushToast("Erreur lors du chargement des demandes.", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, search, sortBy, sortDir, page, refreshKey]);

  const setBusy = (id: number, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const applyAction = async (order: AdminOrder, action: "publish" | "reject" | "fulfill") => {
    setBusy(order.id, true);
    try {
      const res = await api.post(`/admin/orders/${order.id}/status`, { action });
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: res.data.order.status } : o))
      );
      pushToast(res.data.message ?? "Demande mise à jour.");
      setRefreshKey((k) => k + 1);
    } catch {
      pushToast("Erreur lors de la mise à jour.", "error");
    } finally {
      setBusy(order.id, false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-black text-gray-950 leading-tight flex items-center gap-2">
          <Search className="w-6 h-6 text-[#6D28D9]" /> Modération des demandes
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          Validez, rejetez ou marquez comme satisfaites les demandes de livres des utilisateurs.
        </p>
      </header>

      {/* Onglets statut avec compteurs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.val}
            onClick={() => {
              setStatus(tab.val);
              setPage(1);
            }}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
              status === tab.val
                ? "bg-[#6D28D9] text-white border-[#6D28D9]"
                : "bg-white text-gray-600 border-gray-200 hover:border-[#6D28D9]/40 hover:text-[#6D28D9]"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 opacity-70">
              {tab.val === "all"
                ? Object.values(statusCounts).reduce((a, b) => a + b, 0)
                : (statusCounts[tab.val] ?? 0)}
            </span>
          </button>
        ))}
      </div>

      {/* Recherche + tri */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Titre, auteur, ISBN ou vendeur…"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/40 focus:border-[#6D28D9]"
          />
        </div>
        <select
          value={`${sortBy}:${sortDir}`}
          onChange={(e) => {
            const [by, dir] = e.target.value.split(":");
            setSortBy(by);
            setSortDir(dir as "asc" | "desc");
            setPage(1);
          }}
          className="bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/40 cursor-pointer"
        >
          <option value="created_at:desc">Plus récentes</option>
          <option value="created_at:asc">Plus anciennes</option>
          <option value="title:asc">Titre A→Z</option>
          <option value="title:desc">Titre Z→A</option>
        </select>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#6D28D9]" />
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center text-sm text-gray-500">
          Aucune demande pour ce filtre.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col lg:flex-row lg:items-center gap-4"
            >
              {order.cover_url ? (
                <img
                  src={order.cover_url}
                  alt={`Couverture : ${order.title}`}
                  className="w-12 h-16 object-cover rounded-lg shrink-0"
                />
              ) : (
                <div className="w-12 h-16 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center">
                  <Search className="h-5 w-5 text-gray-300" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-gray-900 truncate">{order.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {[order.author, order.isbn, order.category].filter(Boolean).join(" · ") || "—"}
                </p>
                <p className="text-xs text-gray-400 mt-1 truncate">
                  Par {order.user?.nickname || `utilisateur #${order.user?.id ?? "?"}`}
                  {" · "}
                  {order.created_at ? new Date(order.created_at).toLocaleDateString("fr-FR") : "—"}
                </p>
              </div>

              <span
                className={`shrink-0 px-2.5 py-1 rounded-full border text-[11px] font-black uppercase tracking-wide ${
                  STATUS_STYLES[order.status] ?? "bg-gray-100 text-gray-600 border-gray-200"
                }`}
              >
                {order.status.replace("_", " ")}
              </span>

              <div className="flex items-center gap-2 shrink-0">
                {busyIds.has(order.id) ? (
                  <Loader2 className="h-5 w-5 animate-spin text-[#6D28D9]" />
                ) : (
                  <>
                    {order.status !== "published" && (
                      <button
                        onClick={() => applyAction(order, "publish")}
                        title="Publier la demande"
                        className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    )}
                    {order.status === "published" && (
                      <button
                        onClick={() => applyAction(order, "fulfill")}
                        title="Marquer comme satisfaite"
                        className="p-2 rounded-lg bg-violet-50 text-[#6D28D9] hover:bg-violet-100 transition-all cursor-pointer"
                      >
                        <PackageCheck className="h-4 w-4" />
                      </button>
                    )}
                    {order.status !== "rejected" && (
                      <button
                        onClick={() => applyAction(order, "reject")}
                        title="Rejeter la demande"
                        className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all cursor-pointer"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-xs font-bold disabled:opacity-40 hover:border-[#6D28D9]/40 cursor-pointer disabled:cursor-not-allowed"
          >
            Précédent
          </button>
          <span className="text-xs text-gray-500 font-bold">
            Page {page} / {lastPage} · {total} demandes
          </span>
          <button
            disabled={page >= lastPage}
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-xs font-bold disabled:opacity-40 hover:border-[#6D28D9]/40 cursor-pointer disabled:cursor-not-allowed"
          >
            Suivant
          </button>
        </div>
      )}

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-xl shadow-lg text-sm font-bold ${
              toast.type === "error"
                ? "bg-rose-600 text-white"
                : toast.type === "warning"
                  ? "bg-amber-500 text-white"
                  : "bg-gray-900 text-white"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
