"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/axios";
import { 
  Loader2, Search, BookOpen, Clock, CheckCircle, XCircle, 
  Grid, List, Plus, Trash2, Edit, MessageSquare, Sparkles 
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

interface Order {
  id: number;
  book_id?: number | null;
  title: string;
  author?: string | null;
  isbn?: string | null;
  category_id?: number | null;
  cover_path?: string | null;
  cover_url?: string | null;
  cover_thumbnail_url?: string | null;
  cover_thumbnail_url_320?: string | null;
  comment?: string | null;
  status: "pending_admin" | "published" | "fulfilled" | "cancelled" | "rejected";
  published_at?: string | null;
  created_at: string;
  book?: {
    id: number;
    title: string;
    authors?: string[] | string | null;
    isbn_13?: string | null;
    cover_url?: string | null;
    cover_thumbnail_url?: string | null;
  } | null;
  category?: {
    id: number;
    name_fr: string;
  } | null;
}

export default function DemandesPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { success, error: toastError } = useToast();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [statusFilter, setStatusFilter] = useState<string>("published");

  // Confirmation d'annulation inline
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }

    if (isAuthenticated) {
      fetchOrders();
    }
  }, [isAuthenticated, authLoading, statusFilter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/orders?status=${statusFilter}`);
      setOrders(data.orders || []);
    } catch (err) {
      console.error("Erreur chargement demandes:", err);
      toastError("Impossible de charger vos demandes.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    setIsCancelling(true);
    try {
      await api.post(`/orders/${orderId}/cancel`);
      success("Demande annulée avec succès.");
      setCancellingOrderId(null);
      fetchOrders();
    } catch (err: any) {
      console.error("Erreur annulation:", err);
      toastError(err.response?.data?.message || "Erreur lors de l'annulation.");
    } finally {
      setIsCancelling(false);
    }
  };

  const getCover = (order: Order) => 
    order.cover_thumbnail_url || order.cover_url || order.book?.cover_thumbnail_url || order.book?.cover_url || null;

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>, order: Order) => {
    const fallback = order.cover_url || order.book?.cover_url;
    if (fallback && e.currentTarget.src !== fallback) {
      e.currentTarget.src = fallback;
    } else {
      e.currentTarget.style.display = "none";
    }
  };

  return (
    <div className="w-[92%] max-w-6xl mx-auto py-8">
      {/* En-tête */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <Search className="w-7 h-7 text-[#6D28D9]" /> Mes demandes de livres
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gérez vos demandes de livres publiées et recevez des propositions des vendeurs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Switcher Grille / Tableau */}
          <div className="bg-gray-100 p-1 rounded-xl flex items-center">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                viewMode === "grid" ? "bg-white text-gray-900 shadow-xs font-bold" : "text-gray-500 hover:text-gray-900"
              }`}
              title="Vue grille"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                viewMode === "table" ? "bg-white text-gray-900 shadow-xs font-bold" : "text-gray-500 hover:text-gray-900"
              }`}
              title="Vue tableau"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Bouton gris : Redirige vers /dashboard/demandes/create */}
          <Link
            href="/dashboard/demandes/create"
            className="px-4 py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Saisie manuelle</span>
          </Link>

          {/* Bouton violet : Redirige vers /books */}
          <Link
            href="/books"
            className="px-4 py-2.5 bg-[#6D28D9] text-white rounded-xl font-bold text-xs sm:text-sm hover:bg-violet-800 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>Catalogue des livres</span>
          </Link>
        </div>
      </div>

      {/* Onglets de Statut */}
      <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-3">
        <button
          onClick={() => setStatusFilter("published")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            statusFilter === "published"
              ? "bg-violet-50 text-[#6D28D9] border border-violet-200"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          En ligne (Publiées)
        </button>
        <button
          onClick={() => setStatusFilter("pending_admin")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            statusFilter === "pending_admin"
              ? "bg-amber-50 text-amber-700 border border-amber-200"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          En attente de modération
        </button>
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            statusFilter === "all"
              ? "bg-gray-100 text-gray-900 border border-gray-300"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Toutes mes demandes
        </button>
      </div>

      {/* Liste des Demandes */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="animate-spin h-8 w-8 text-[#6D28D9]" />
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-xs">
          <div className="w-14 h-14 bg-violet-50 text-[#6D28D9] rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Search className="w-7 h-7" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">
            {statusFilter === "published" ? "Aucune demande en ligne actuellement" : "Aucune demande trouvée"}
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto mb-5">
            Vous cherchez un manuel scolaire, un roman ou un livre épuisé ?
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/dashboard/demandes/create"
              className="px-4 py-2 bg-gray-100 text-gray-800 rounded-xl font-bold text-xs hover:bg-gray-200 transition-all cursor-pointer"
            >
              Saisie manuelle directe
            </Link>
            <Link
              href="/books"
              className="px-5 py-2 bg-[#6D28D9] text-white rounded-xl font-bold text-xs hover:bg-violet-800 transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" /> Parcourir le catalogue
            </Link>
          </div>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => {
            const cover = getCover(order);
            const isCancellingThis = cancellingOrderId === order.id;

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex gap-3.5 mb-3">
                    <div className="w-16 h-20 bg-gray-50 rounded-xl shrink-0 border border-gray-100 overflow-hidden relative flex items-center justify-center">
                      {cover ? (
                        <img 
                          src={cover} 
                          className="w-full h-full object-cover" 
                          alt="" 
                          onError={(e) => handleImageError(e, order)}
                        />
                      ) : (
                        <BookOpen className="w-6 h-6 text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        {order.status === "published" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <CheckCircle className="w-3 h-3" /> Publiée
                          </span>
                        )}
                        {order.status === "pending_admin" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" /> En attente de modération
                          </span>
                        )}
                        {order.status === "fulfilled" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                            <CheckCircle className="w-3 h-3" /> Trouvé
                          </span>
                        )}
                        {order.status === "cancelled" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            <XCircle className="w-3 h-3" /> Annulée
                          </span>
                        )}
                        {!order.book_id && (
                          <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">
                            Hors catalogue
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-gray-900 text-sm line-clamp-2 leading-snug">{order.title}</h4>
                      {order.author && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{order.author}</p>}
                      {order.isbn && <p className="text-[11px] text-gray-400 font-mono mt-0.5">ISBN: {order.isbn}</p>}
                    </div>
                  </div>

                  {order.comment && (
                    <div className="text-xs text-gray-600 bg-gray-50/80 border border-gray-100 p-2.5 rounded-xl mb-3 flex items-start gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                      <p className="italic leading-relaxed">{order.comment}</p>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-2">
                  {isCancellingThis ? (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-rose-800">Confirmer l'annulation ?</p>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setCancellingOrderId(null)}
                          className="px-2 py-1 text-xs text-gray-600 hover:bg-rose-100 rounded-lg font-semibold cursor-pointer"
                        >
                          Non
                        </button>
                        <button
                          onClick={() => handleCancelOrder(order.id)}
                          disabled={isCancelling}
                          className="px-2.5 py-1 text-xs bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          {isCancelling && <Loader2 className="w-3 h-3 animate-spin" />}
                          Oui, annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] text-gray-400">
                        {order.published_at ? (
                          <span>Publiée le {new Date(order.published_at).toLocaleDateString("fr-FR")}</span>
                        ) : (
                          <span>Créée le {new Date(order.created_at).toLocaleDateString("fr-FR")}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Lien vers /dashboard/demandes/update/{id} */}
                        <Link
                          href={`/dashboard/demandes/update/${order.id}`}
                          className="text-xs font-bold text-gray-600 hover:text-[#6D28D9] transition-colors flex items-center gap-1 cursor-pointer"
                          title="Modifier la demande"
                        >
                          <Edit className="w-3.5 h-3.5" /> Modifier
                        </Link>

                        {order.status !== "cancelled" && (
                          <button
                            onClick={() => setCancellingOrderId(order.id)}
                            className="text-xs font-bold text-rose-600 hover:text-rose-800 transition-colors flex items-center gap-1 cursor-pointer"
                            title="Annuler la demande"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Annuler
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50/80 border-b border-gray-100 text-xs uppercase font-bold text-gray-700">
                <tr>
                  <th className="px-5 py-3.5">Livre</th>
                  <th className="px-5 py-3.5">Auteur / ISBN</th>
                  <th className="px-5 py-3.5">Commentaire</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Statut</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order) => {
                  const cover = getCover(order);
                  const isCancellingThis = cancellingOrderId === order.id;

                  return (
                    <tr key={order.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-4 font-bold text-gray-900">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-12 bg-gray-50 rounded-md shrink-0 border border-gray-100 overflow-hidden relative flex items-center justify-center">
                            {cover ? (
                              <img 
                                src={cover} 
                                className="w-full h-full object-cover" 
                                alt="" 
                                onError={(e) => handleImageError(e, order)}
                              />
                            ) : (
                              <BookOpen className="w-4 h-4 text-gray-300" />
                            )}
                          </div>
                          <div>
                            <p className="line-clamp-1">{order.title}</p>
                            {!order.book_id && (
                              <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-1.5 py-0.2 rounded">
                                Hors catalogue
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-xs text-gray-700">{order.author || "-"}</p>
                        {order.isbn && <p className="text-[11px] font-mono text-gray-400">{order.isbn}</p>}
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-500 max-w-xs truncate">
                        {order.comment || "-"}
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-500 whitespace-nowrap">
                        {order.published_at
                          ? new Date(order.published_at).toLocaleDateString("fr-FR")
                          : new Date(order.created_at).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {order.status === "published" && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <CheckCircle className="w-3 h-3" /> Publiée
                          </span>
                        )}
                        {order.status === "pending_admin" && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" /> Modération
                          </span>
                        )}
                        {order.status === "fulfilled" && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                            <CheckCircle className="w-3 h-3" /> Trouvé
                          </span>
                        )}
                        {order.status === "cancelled" && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            <XCircle className="w-3 h-3" /> Annulée
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        {isCancellingThis ? (
                          <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg">
                            <span className="text-[11px] font-bold text-rose-800">Confirmer ?</span>
                            <button
                              onClick={() => handleCancelOrder(order.id)}
                              disabled={isCancelling}
                              className="text-[11px] bg-rose-600 text-white px-2 py-0.5 rounded font-bold hover:bg-rose-700 cursor-pointer"
                            >
                              Oui
                            </button>
                            <button
                              onClick={() => setCancellingOrderId(null)}
                              className="text-[11px] text-gray-600 hover:text-gray-900 px-1 font-semibold cursor-pointer"
                            >
                              Non
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            {/* Lien vers /dashboard/demandes/update/{id} */}
                            <Link
                              href={`/dashboard/demandes/update/${order.id}`}
                              className="p-1 text-gray-500 hover:text-[#6D28D9] transition-colors cursor-pointer"
                              title="Modifier"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                            {order.status !== "cancelled" && (
                              <button
                                onClick={() => setCancellingOrderId(order.id)}
                                className="p-1 text-gray-400 hover:text-rose-600 transition-colors cursor-pointer"
                                title="Annuler"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
