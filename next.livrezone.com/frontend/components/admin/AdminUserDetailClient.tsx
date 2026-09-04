"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Loader2,
  MessageCircle,
  MessageSquare,
  Phone,
  X,
} from "lucide-react";
import api from "@/lib/axios";
import { getApiErrorMessage } from "@/lib/api-error";
import ToastContainer, { ToastData, ToastType } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";

// ------------------------------------------------------------------
// Types (miroir de App\Services\AdminDashboardService::getUserDetail)
// ------------------------------------------------------------------

interface AdminUserDetail {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
  is_active: boolean;
  profile: {
    nickname?: string | null;
    phone?: string | null;
    has_whatsapp?: boolean | null;
    logo?: string | null;
    subscription_type?: string | null;
    paused_from_type?: string | null;
    paused_at?: string | null;
    city?: { name?: string | null } | null;
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
  payments: AdminPayment[];
}

interface AdminPayment {
  id: number;
  amount: string | number;
  payment_method: string;
  transaction_id: string | null;
  subscription_type: string;
  period: string | null;
  discount_code: string | null;
  status: string;
  paid_at: string | null;
  expires_at: string | null;
  created_at: string;
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: "Payé",
  pending: "En attente",
  failed: "Échoué",
};

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
};

const SUBSCRIPTION_LABELS: Record<string, string> = {
  free: "Gratuit",
  pro: "Pro",
  premium: "Premium",
};

function formatDate(value?: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("fr-FR");
  } catch {
    return "—";
  }
}

function getAvatarUrl(p?: AdminUserDetail["profile"]): string | null {
  if (!p?.logo) return null;
  if (p.logo.startsWith("http")) return p.logo;
  return `https://api-next.livrezone.com${p.logo}`;
}

export default function AdminUserDetailClient({ userId }: { userId: number }) {
  const queryClient = useQueryClient();
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const toastIdRef = useRef(0);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState<null | boolean>(null); // true = désactiver

  const pushToast = (message: string, type: ToastType = "success") => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 260);
    }, 3200);
  };

  const dismissToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "user", userId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/users/${userId}`);
      return data as AdminUserDetail;
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (is_active: boolean) => {
      const { data } = await api.post(`/admin/users/${userId}/status`, { is_active });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "user", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "listings"] });
    },
  });

  const handleToggle = (deactivate: boolean) => {
    statusMutation
      .mutateAsync(!deactivate)
      .then((res) => pushToast(res?.message || (deactivate ? "Utilisateur désactivé." : "Utilisateur activé.")))
      .catch((e) => pushToast(getApiErrorMessage(e, "Erreur lors de la mise à jour."), "warning"));
  };

  // ------------------------------------------------------------------
  // WhatsApp : même comportement que ListingDetailsCard
  // ------------------------------------------------------------------
  const rawPhone = data?.profile?.phone || "";
  let cleanPhone = rawPhone.replace(/[^0-9]/g, "");
  if (cleanPhone.startsWith("0")) {
    cleanPhone = "212" + cleanPhone.substring(1);
  }
  // Détection automatique : les numéros fixes marocains (05...) n'ont pas WhatsApp
  const isLandline = cleanPhone ? /^(?:05|2125|5\d{8})/.test(cleanPhone) : false;
  const hasWhatsapp = data?.profile?.has_whatsapp !== false && !isLandline && Boolean(cleanPhone);
  const waMessage = encodeURIComponent("Bonjour, je vous contacte depuis LivreZone.");
  const telLink = rawPhone.replace(/[^0-9]/g, "") ? `tel:+${cleanPhone}` : "#";

  const user = data;

  return (
    <div className="space-y-6 font-sans">
      <ToastContainer toasts={toasts} dismiss={dismissToast} />

      {/* Fil d'ariane */}
      <div>
        <Link
          href="/admin/utilisateurs"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-[#6D28D9] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Retour aux utilisateurs
        </Link>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-gray-400">Chargement de la fiche...</div>
      ) : isError || !user ? (
        <div className="py-16 text-center text-sm text-gray-400">Utilisateur introuvable.</div>
      ) : (
        <>
          {/* ---------------- Fiche utilisateur ---------------- */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-xs p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-5">
              {/* Avatar */}
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#6D28D9] to-[#1a0a40] text-white flex items-center justify-center text-2xl font-black overflow-hidden flex-shrink-0">
                {getAvatarUrl(user.profile) ? (
                  <img src={getAvatarUrl(user.profile) as string} alt="" className="w-full h-full object-cover" />
                ) : (
                  (user.name || "?").charAt(0).toUpperCase()
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-gray-950 leading-tight">{user.name}</h1>
                  {user.is_admin && (
                    <span className="text-[9px] bg-violet-600 text-white font-bold px-1.5 py-0.5 rounded-sm uppercase">Admin</span>
                  )}
                  {user.is_active ? (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">Actif</span>
                  ) : (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border bg-rose-50 text-rose-700 border-rose-200">Désactivé</span>
                  )}
                </div>
                <p className="text-sm text-gray-600 font-medium mt-0.5 break-all">{user.email}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className={`w-2 h-2 rounded-full ${user.connection?.online ? "bg-emerald-400" : "bg-gray-300"}`}></span>
                  <span className="text-[11px] font-bold text-gray-500">
                    {user.connection?.online ? "En ligne" : "Hors ligne"}
                  </span>
                  {user.profile?.city?.name && (
                    <span className="text-[11px] text-gray-400">· {user.profile.city.name}</span>
                  )}
                </div>

                {/* Boutons d'action : désactiver / activer */}
                <div className="flex flex-wrap gap-2.5 mt-4">
                  {user.is_active ? (
                    <button
                      onClick={() => setConfirmToggle(true)}
                      disabled={statusMutation.isPending}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {statusMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                      Désactiver
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmToggle(false)}
                      disabled={statusMutation.isPending}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {statusMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Activer
                    </button>
                  )}
                </div>
              </div>

              {/* Actions de contact (même comportement que listing-details) */}
              <div className="w-full sm:w-56 shrink-0 space-y-2.5">
                {hasWhatsapp && (
                  <a
                    href={`https://wa.me/${cleanPhone}?text=${waMessage}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-11 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-[0.99]"
                  >
                    <MessageCircle className="w-4 h-4 fill-current" />
                    <span>Contacter sur WhatsApp</span>
                  </a>
                )}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => setShowPhoneModal(true)}
                    className="h-11 rounded-xl bg-white border border-gray-300 text-gray-800 hover:bg-gray-50 hover:border-gray-400 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                  >
                    <Phone className="w-4 h-4 text-gray-600" />
                    <span>Téléphone</span>
                  </button>
                  <Link
                    href={`/chat?user=${user.id}`}
                    className="h-11 rounded-xl bg-white border border-gray-300 text-gray-800 hover:bg-gray-50 hover:border-gray-400 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                  >
                    <MessageSquare className="w-4 h-4 text-gray-600" />
                    <span>Message</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Informations du compte */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 pt-5 border-t border-gray-100">
              {[
                { label: "Statut", value: user.is_active ? "Actif" : "Désactivé", cls: user.is_active ? "text-emerald-600" : "text-rose-500" },
                { label: "Connexion", value: user.connection?.online ? "En ligne" : "Hors ligne", cls: "text-gray-900" },
                { label: "Dernière connexion", value: formatDate(user.last_login_at), cls: "text-gray-900" },
                { label: "Nombre d'annonces", value: String(user.listings_count ?? 0), cls: "text-[#6D28D9]" },
                {
                  label: "Abonnement",
                  value:
                    (user.profile?.paused_from_type ? `En pause (ex-${SUBSCRIPTION_LABELS[user.profile.paused_from_type] ?? user.profile.paused_from_type})` : "") ||
                    (SUBSCRIPTION_LABELS[user.profile?.subscription_type ?? "free"] ?? "Gratuit"),
                  cls: "text-gray-900",
                },
                { label: "Date d'inscription", value: formatDate(user.created_at), cls: "text-gray-900" },
                { label: "Téléphone", value: user.profile?.phone || "—", cls: "text-gray-900" },
                { label: "Pseudo", value: user.profile?.nickname || "—", cls: "text-gray-900" },
              ].map((f, i) => (
                <div key={i} className="bg-gray-50 rounded-lg px-3.5 py-2.5">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">{f.label}</span>
                  <span className={`text-sm font-bold ${f.cls}`}>{f.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ---------------- Paiements ---------------- */}
          <div>
            <h2 className="text-sm font-black text-gray-950 uppercase tracking-wider mb-3">Paiements</h2>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
              {!user.payments || user.payments.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">Aucun paiement enregistré.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-left">
                        <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-gray-400 w-14">ID</th>
                        <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-gray-400">Montant</th>
                        <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-gray-400">Méthode</th>
                        <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-gray-400">Abonnement</th>
                        <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-gray-400">Statut</th>
                        <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-gray-400">Payé le</th>
                        <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-gray-400">Expire le</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {user.payments.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="px-4 py-3 text-gray-400 text-xs">#{p.id}</td>
                          <td className="px-4 py-3 font-bold text-gray-900 text-xs">{Number(p.amount).toFixed(2)} MAD</td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{p.payment_method}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{SUBSCRIPTION_LABELS[p.subscription_type] ?? p.subscription_type}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${PAYMENT_STATUS_STYLES[p.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                              {PAYMENT_STATUS_LABELS[p.status] ?? p.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(p.paid_at)}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(p.expires_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ---------------- Confirmations & modale téléphone ---------------- */}
          <ConfirmDialog
            open={confirmToggle === true}
            title="Désactiver cet utilisateur ?"
            message={
              user
                ? `${user.name} ne pourra plus se connecter ni publier. Toutes ses annonces en ligne seront masquées ; sa réactivation les remettra automatiquement en ligne.`
                : ""
            }
            confirmLabel="Désactiver"
            cancelLabel="Annuler"
            danger
            onConfirm={() => {
              handleToggle(true);
              setConfirmToggle(null);
            }}
            onCancel={() => setConfirmToggle(null)}
          />
          <ConfirmDialog
            open={confirmToggle === false}
            title="Activer cet utilisateur ?"
            message={
              user
                ? `${user.name} pourra de nouveau se connecter et publier. Ses annonces masquées seront remises en ligne.`
                : ""
            }
            confirmLabel="Activer"
            onConfirm={() => {
              handleToggle(false);
              setConfirmToggle(null);
            }}
            onCancel={() => setConfirmToggle(null)}
          />

          {showPhoneModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
              <div className="relative w-full max-w-sm bg-white shadow-2xl rounded-xl border-t-4 border-[#1a0a40] overflow-hidden">
                <button
                  onClick={() => setShowPhoneModal(false)}
                  className="absolute top-3 right-3 text-gray-400 hover:text-gray-900 focus:outline-none p-1 cursor-pointer"
                  aria-label="Fermer"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 bg-gray-50 text-[#1a0a40]">
                    <Phone className="w-6 h-6" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-gray-900">Contact Téléphonique</h3>
                  <p className="mb-6 text-xs text-gray-500 leading-normal">
                    Numéro de téléphone de {user.name} :
                  </p>

                  <div className="text-xl font-black tracking-wider text-gray-900 mb-6 bg-gray-50 py-3 rounded-lg border border-gray-100 font-mono">
                    {user.profile?.phone || "Numéro non renseigné"}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowPhoneModal(false)}
                      className="w-1/2 py-2.5 rounded-lg text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      Annuler
                    </button>
                    {user.profile?.phone ? (
                      <a
                        href={telLink}
                        className="w-1/2 py-2.5 rounded-lg text-xs font-bold text-white hover:opacity-90 flex items-center justify-center gap-1.5 transition-opacity cursor-pointer"
                        style={{ backgroundColor: "#1a0a40" }}
                      >
                        <Phone className="h-3.5 w-3.5" />
                        Appeler
                      </a>
                    ) : (
                      <button
                        disabled
                        className="w-1/2 py-2.5 rounded-lg text-xs font-bold text-gray-400 bg-gray-100 border border-gray-200 cursor-not-allowed"
                      >
                        Indisponible
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

