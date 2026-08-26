"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgePercent,
  Banknote,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import api from "@/lib/axios";
import SortableTh from "@/components/SortableTh";
import ConfirmDialog from "@/components/ConfirmDialog";

interface AdminPayment {
  id: number;
  user: { id: number; email: string; nickname: string | null } | null;
  amount: number;
  payment_method: string;
  transaction_id: string | null;
  subscription_type: string;
  status: string;
  paid_at: string | null;
  expires_at: string | null;
}

interface DiscountCode {
  id: number;
  code: string;
  type: "percent" | "fixed";
  value: string;
  is_active: boolean;
  expires_at: string | null;
  max_uses: number | null;
  times_used: number;
}

const STATUS_TABS = [
  { val: "all", label: "Tous" },
  { val: "paid", label: "Payés" },
  { val: "pending", label: "En attente" },
  { val: "failed", label: "Échoués" },
] as const;

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
};

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export default function AdminPaymentsClient() {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [promoActive, setPromoActive] = useState<boolean | null>(null);

  const [settings, setSettings] = useState<Record<string, number> | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [showCodeForm, setShowCodeForm] = useState(false);
  const [form, setForm] = useState({ code: "", type: "percent", value: "", max_uses: "" });
  const [savingCode, setSavingCode] = useState(false);
  const [confirmDeleteCode, setConfirmDeleteCode] = useState<DiscountCode | null>(null);

  const toastsRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const pushToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
    toastsRef.current?.scrollIntoView?.({ block: "nearest" });
  };

  // Chargement paiements
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await api.get("/admin/payments", {
          params: {
            status,
            type,
            search: search || undefined,
            sort_by: sortBy,
            sort_dir: sortDir,
            limit: 20,
            page,
          },
        });
        if (!cancelled) {
          setPayments(res.data.payments ?? []);
          setStats(res.data.meta?.stats ?? {});
          setTotal(res.data.meta?.total ?? 0);
          setLastPage(res.data.meta?.last_page ?? 1);
        }
      } catch {
        if (!cancelled) pushToast("Erreur lors du chargement des paiements.", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, type, search, sortBy, sortDir, page]);

  // État promo + codes + réglages tarification
  useEffect(() => {
    (async () => {
      try {
        const [promo, codesRes, settingsRes] = await Promise.all([
          api.get("/admin/promo"),
          api.get("/admin/discount-codes"),
          api.get("/admin/settings"),
        ]);
        setPromoActive(promo.data.promo_pro_free ?? false);
        setCodes(codesRes.data.codes ?? []);
        setSettings(settingsRes.data.settings ?? null);
      } catch {
        // silencieux
      }
    })();
  }, []);

  const saveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    try {
      const res = await api.put("/admin/settings", {
        max_free_listings: Number(settings.max_free_listings),
        pro_price: Number(settings.pro_price),
        premium_price: Number(settings.premium_price),
        notification_delay_hours: Number(settings.notification_delay_hours),
        subscription_grace_period_days: Number(settings.subscription_grace_period_days),
      });
      setSettings(res.data.settings);
      pushToast(res.data.message ?? "Réglages mis à jour.");
    } catch {
      pushToast("Erreur lors de la sauvegarde des réglages.", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  const updateSettingField = (key: string, value: string) => {
    setSettings((s) => {
      if (!s) return s;
      return { ...s, [key]: value === "" ? 0 : Number(value) };
    });
  };

  const togglePromo = async () => {
    try {
      const res = await api.post("/admin/promo/toggle", { active: !promoActive });
      setPromoActive(res.data.promo_pro_free);
      pushToast(res.data.message ?? "Promo mise à jour.");
    } catch {
      pushToast("Erreur lors du changement de promo.", "error");
    }
  };

  const createCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCode(true);
    try {
      await api.post("/admin/discount-codes", {
        code: form.code,
        type: form.type,
        value: Number(form.value),
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        is_active: true,
      });
      const codesRes = await api.get("/admin/discount-codes");
      setCodes(codesRes.data.codes ?? []);
      setForm({ code: "", type: "percent", value: "", max_uses: "" });
      setShowCodeForm(false);
      pushToast("Code de réduction créé.");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Erreur lors de la création du code.";
      pushToast(message, "error");
    } finally {
      setSavingCode(false);
    }
  };

  const deleteCode = async (id: number) => {
    try {
      await api.delete(`/admin/discount-codes/${id}`);
      setCodes((prev) => prev.filter((c) => c.id !== id));
      pushToast("Code supprimé.");
    } catch {
      pushToast("Erreur lors de la suppression.", "error");
    }
  };

  const requestDeleteCode = (code: DiscountCode) => {
    setConfirmDeleteCode(code);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
    setPage(1);
  };

  const tiles = [
    { label: "Revenus encaissés", value: `${stats.revenue_paid ?? 0} MAD`, icon: Banknote },
    { label: "Paiements payés", value: stats.count_paid ?? 0, icon: TrendingUp },
    { label: "Échéances < 30 j", value: stats.expiring_soon ?? 0, icon: Clock },
    { label: "Échecs", value: stats.count_failed ?? 0, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-950 leading-tight flex items-center gap-2">
            <Banknote className="w-6 h-6 text-[#F97316]" /> Paiements & Promos
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Suivi des paiements, des échéances d&apos;abonnement et des promotions.
          </p>
        </div>
      </header>

      {/* Tuiles statistiques */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4">
            <Icon className="h-5 w-5 text-[#F97316]" />
            <p className="text-xl lg:text-2xl font-black text-gray-950 mt-2">{value}</p>
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tarification & Réglages */}
      {settings && (
        <section className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-black text-sm uppercase tracking-wider text-gray-700 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#F97316]" /> Tarification &amp; Réglages abonnements
            </h2>
            <button
              onClick={saveSettings}
              disabled={savingSettings}
              className="flex items-center gap-1.5 bg-[#6D28D9] hover:bg-violet-800 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all cursor-pointer disabled:opacity-50"
            >
              {savingSettings ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Enregistrer
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mb-4">
            Effet immédiat, sans redéploiement. Ces valeurs remplacent celles du fichier de configuration.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Annonces max (Free)</span>
              <input
                type="number"
                min="0"
                value={settings.max_free_listings}
                onChange={(e) => updateSettingField("max_free_listings", e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Prix Pro (MAD)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={settings.pro_price}
                onChange={(e) => updateSettingField("pro_price", e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Prix Premium (MAD)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={settings.premium_price}
                onChange={(e) => updateSettingField("premium_price", e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Délai visibilité demandes (h)</span>
              <input
                type="number"
                min="0"
                value={settings.notification_delay_hours}
                onChange={(e) => updateSettingField("notification_delay_hours", e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Délai de grâce (jours)</span>
              <input
                type="number"
                min="0"
                value={settings.subscription_grace_period_days}
                onChange={(e) => updateSettingField("subscription_grace_period_days", e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
              />
            </label>
          </div>
        </section>
      )}

      {/* Promo Pro gratuit */}
      <div
        className={`rounded-2xl border p-5 flex items-center justify-between gap-4 ${
          promoActive ? "bg-orange-50 border-orange-200" : "bg-white border-gray-100"
        }`}
      >
        <div className="flex items-center gap-3">
          <BadgePercent className={`h-8 w-8 ${promoActive ? "text-[#F97316]" : "text-gray-300"}`} />
          <div>
            <p className="font-black text-sm uppercase tracking-wide text-gray-950">
              Promo « Pro offert » pour les comptes gratuits
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Les comptes free bénéficient temporairement des avantages Pro.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={togglePromo}
          disabled={promoActive === null}
          role="switch"
          aria-checked={!!promoActive}
          className={`relative inline-flex h-7 w-13 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-40 ${
            promoActive ? "bg-[#F97316]" : "bg-gray-300"
          }`}
          style={{ width: "3.25rem" }}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              promoActive ? "translate-x-7" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Codes de réduction */}
      <section className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-sm uppercase tracking-wider text-gray-700 flex items-center gap-2">
            <BadgePercent className="h-4 w-4 text-[#F97316]" /> Codes de réduction ({codes.length})
          </h2>
          <button
            onClick={() => setShowCodeForm((s) => !s)}
            className="flex items-center gap-1.5 bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-bold px-3 py-2 rounded-lg transition-all cursor-pointer"
          >
            {showCodeForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showCodeForm ? "Annuler" : "Nouveau code"}
          </button>
        </div>

        {showCodeForm && (
          <form onSubmit={createCode} className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5 p-4 bg-orange-50/50 rounded-xl border border-orange-100">
            <input
              required
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="CODE"
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
            />
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none cursor-pointer"
            >
              <option value="percent">% remise</option>
              <option value="fixed">Montant fixe (MAD)</option>
            </select>
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              placeholder="Valeur"
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
            />
            <input
              type="number"
              min="1"
              value={form.max_uses}
              onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value }))}
              placeholder="Utilisations max"
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
            />
            <button
              type="submit"
              disabled={savingCode}
              className="flex items-center justify-center gap-2 bg-[#6D28D9] hover:bg-violet-800 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all cursor-pointer disabled:opacity-50"
            >
              {savingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Créer
            </button>
          </form>
        )}

        {codes.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">Aucun code de réduction.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-50 border-b border-gray-150 text-gray-500 uppercase text-[10px] font-bold">
                <tr>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Valeur</th>
                  <th className="px-3 py-2">Utilisations</th>
                  <th className="px-3 py-2">Expiration</th>
                  <th className="px-3 py-2">Statut</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {codes.map((c) => {
                  const dLeft = daysUntil(c.expires_at);
                  return (
                    <tr key={c.id}>
                      <td className="px-3 py-2 font-black text-gray-900">{c.code}</td>
                      <td className="px-3 py-2">{c.type === "percent" ? "Pourcentage" : "Fixe"}</td>
                      <td className="px-3 py-2 font-bold">
                        {c.value}
                        {c.type === "percent" ? "%" : " MAD"}
                      </td>
                      <td className="px-3 py-2">
                        {c.times_used}
                        {c.max_uses ? ` / ${c.max_uses}` : ""}
                      </td>
                      <td className="px-3 py-2">
                        {c.expires_at ? new Date(c.expires_at).toLocaleDateString("fr-FR") : "—"}
                        {dLeft !== null && dLeft <= 7 && dLeft >= 0 && (
                          <span className="ml-1 text-orange-600 font-bold">(J-{dLeft})</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase ${
                            c.is_active
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-gray-100 text-gray-500 border-gray-200"
                          }`}
                        >
                          {c.is_active ? "Actif" : "Inactif"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => requestDeleteCode(c)}
                          title="Supprimer le code"
                          className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Liste des paiements */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-black text-sm uppercase tracking-wider text-gray-700">
            Historique des paiements ({total})
          </h2>
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.val}
                onClick={() => {
                  setStatus(tab.val);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  status === tab.val
                    ? "bg-[#F97316] text-white border-[#F97316]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-[#F97316]/40 hover:text-[#EA580C]"
                }`}
              >
                {tab.label}
              </button>
            ))}
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
              className="bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-600 px-2 cursor-pointer focus:outline-none"
            >
              <option value="all">Tous types</option>
              <option value="pro">Pro</option>
              <option value="premium">Premium</option>
            </select>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Email, pseudo ou transaction…"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#F97316]" />
          </div>
        ) : payments.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center text-sm text-gray-400">
            Aucun paiement pour ce filtre.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[720px]">
              <thead className="bg-gray-50 border-b border-gray-150 text-gray-500 uppercase text-[10px] font-bold">
                <tr>
                  <th className="px-4 py-3">Utilisateur</th>
                  <th className="px-4 py-3">Abonnement</th>
                  <SortableTh
                    label="Montant"
                    field="amount"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <th className="px-4 py-3">Méthode</th>
                  <th className="px-4 py-3">Statut</th>
                  <SortableTh
                    label="Payé le"
                    field="created_at"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableTh
                    label="Échéance"
                    field="expires_at"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((p) => {
                  const dLeft = daysUntil(p.expires_at);
                  return (
                    <tr key={p.id} className="hover:bg-orange-50/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-950 truncate max-w-[160px]">
                          {p.user?.nickname || `utilisateur #${p.user?.id ?? "?"}`}
                        </div>
                        <div className="text-[10px] text-gray-400 truncate max-w-[160px]">{p.user?.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full border text-[10px] font-black uppercase bg-violet-50 text-[#6D28D9] border-violet-200">
                          {p.subscription_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-black text-gray-900">{p.amount} MAD</td>
                      <td className="px-4 py-3 text-gray-600">{p.payment_method}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase ${
                            STATUS_STYLES[p.status] ?? "bg-gray-100 text-gray-500 border-gray-200"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {p.paid_at ? new Date(p.paid_at).toLocaleDateString("fr-FR") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {p.expires_at ? (
                          <span
                            className={`font-bold ${
                              dLeft !== null && dLeft <= 7 ? "text-[#EA580C]" : "text-gray-600"
                            }`}
                          >
                            {new Date(p.expires_at).toLocaleDateString("fr-FR")}
                            {dLeft !== null && dLeft >= 0 && dLeft <= 30 && ` (J-${dLeft})`}
                            {dLeft !== null && dLeft < 0 && " (expirée)"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {lastPage > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-xs font-bold disabled:opacity-40 hover:border-[#F97316]/40 cursor-pointer disabled:cursor-not-allowed"
            >
              Précédent
            </button>
            <span className="text-xs text-gray-500 font-bold">
              Page {page} / {lastPage}
            </span>
            <button
              disabled={page >= lastPage}
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-xs font-bold disabled:opacity-40 hover:border-[#F97316]/40 cursor-pointer disabled:cursor-not-allowed"
            >
              Suivant
            </button>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmDeleteCode !== null}
        title="Supprimer ce code de réduction ?"
        message={
          confirmDeleteCode
            ? `Le code « ${confirmDeleteCode.code} » sera définitivement supprimé.`
            : ""
        }
        confirmLabel="Supprimer"
        danger
        onConfirm={() => {
          if (confirmDeleteCode) deleteCode(confirmDeleteCode.id);
          setConfirmDeleteCode(null);
        }}
        onCancel={() => setConfirmDeleteCode(null)}
      />

      {/* Toast */}
      <div ref={toastsRef}>
        {toast && (
          <div
            className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-bold ${
              toast.type === "error" ? "bg-rose-600 text-white" : "bg-gray-900 text-white"
            }`}
          >
            {toast.type === "success" && <CheckCircle2 className="inline h-4 w-4 mr-2 -mt-0.5" />}
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}
