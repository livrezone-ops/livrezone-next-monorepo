"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  BookOpen, Plus, Search, Grid, List, CheckCircle, 
  Trash2, Tag, Edit, Check, X, ShieldAlert, Heart, ShoppingBag
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/axios";

interface Listing {
  id: number;
  title: string;
  price: number;
  discount_price?: number | null;
  book_condition: string;
  isbn_13?: string | null;
  status: string;
  created_at: string;
  cover_path?: string | null;
  cover_source_url?: string | null;
  book?: {
    cover_url?: string | null;
    authors?: string[] | string | null;
  } | null;
  category?: {
    name_fr: string;
  } | null;
}

interface DashboardClientProps {
  initialListings: Listing[];
}

export default function DashboardClient({ initialListings }: DashboardClientProps) {
  const { user, logout } = useAuth();

  // Miniature en priorité (chargement léger, comme l'ancien projet), avec fallback
  // sur la couverture originale via onError si la miniature n'existe pas.
  const primaryCoverUrl = (l: Listing): string | null =>
    (l as any).cover_thumbnail_url
    || (l as any).cover_url
    || l.book?.cover_url
    || l.cover_source_url
    || null;

  const fallbackCoverUrl = (l: Listing): string | null =>
    (l as any).cover_url
    || l.book?.cover_url
    || l.cover_source_url
    || null;

  const handleCoverError = (e: React.SyntheticEvent<HTMLImageElement>, l: Listing) => {
    const fallback = fallbackCoverUrl(l);
    if (fallback && e.currentTarget.src !== fallback) {
      e.currentTarget.src = fallback;
    } else {
      e.currentTarget.style.display = "none";
    }
  };

  const statusBadge = (l: Listing): { label: string; className: string } => {
    switch (l.status) {
      case "sold":
        return { label: "Vendu", className: "bg-gray-100 text-gray-600 border-gray-200" };
      case "deleted":
        return { label: "Supprimé", className: "bg-rose-50 text-rose-700 border-rose-200" };
      case "rejected":
        return { label: "Rejeté", className: "bg-rose-50 text-rose-700 border-rose-200" };
      case "archived":
        return { label: "Archivé", className: "bg-gray-100 text-gray-500 border-gray-200" };
      case "published":
      case "active":
        return { label: "En ligne", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
      case "hidden":
      case "expired":
        return { label: "Hors ligne", className: "bg-gray-100 text-gray-500 border-gray-200" };
      default:
        return { label: "En attente", className: "bg-amber-50 text-amber-700 border-amber-200" };
    }
  };
  
  const getAvatarUrl = () => {
    if (!user?.profile?.logo) return null;
    if (user.profile.logo.startsWith('http')) return user.profile.logo;
    return `https://api-next.livrezone.com${user.profile.logo}`;
  };

  const buildListingUrl = (l: Listing) => {
    const toSlug = (str: string) => {
      return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    };
    
    const nickname = user?.profile?.nickname || user?.name || "user";
    const slugBase = `${l.isbn_13 ? l.isbn_13 + '-' : ''}${l.title}`;
    const slug = toSlug(slugBase);
    
    return `/${toSlug(nickname)}/${l.id}-${slug}`;
  };

  const [listings, setListings] = useState<Listing[]>(initialListings);
  const [filter, setFilter] = useState<"online" | "offline" | "all">("online");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [viewMode, setViewMode] = useState<"cards" | "table">("table");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkDiscount, setBulkDiscount] = useState("");

  // Inline editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editDiscountPrice, setEditDiscountPrice] = useState<number | null>(null);

  // Stats calculation
  const activeCount = listings.filter(l => ["published", "pending_admin", "active"].includes(l.status)).length;
  const soldCount = listings.filter(l => l.status === "sold").length;

  // Filter & sort logic
  const filteredListings = listings.filter((l) => {
    // Status Filter
    if (filter === "online") {
      if (!["published", "pending_admin", "active"].includes(l.status)) return false;
    } else if (filter === "offline") {
      if (!["sold", "rejected", "deleted", "archived"].includes(l.status)) return false;
    }

    // Search Filter
    if (search.trim() !== "") {
      const q = search.toLowerCase();
      const matchTitle = l.title.toLowerCase().includes(q);
      const matchIsbn = l.isbn_13?.toLowerCase().includes(q) || false;
      return matchTitle || matchIsbn;
    }

    return true;
  }).sort((a, b) => {
    if (sortBy === "price") {
      const priceA = a.discount_price ?? a.price;
      const priceB = b.discount_price ?? b.price;
      return priceA - priceB;
    } else if (sortBy === "title") {
      return a.title.localeCompare(b.title);
    } else {
      // Date order
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  // Checkbox handlers
  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredListings.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredListings.map(l => l.id));
    }
  };

  const handleToggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(x => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleStartEdit = (l: Listing) => {
    setEditingId(l.id);
    setEditTitle(l.title);
    setEditPrice(l.price);
    setEditDiscountPrice(l.discount_price ?? null);
  };

  const handleSaveEdit = async () => {
    if (editDiscountPrice !== null && editDiscountPrice >= editPrice) {
      alert("Le prix réduit doit être inférieur au prix normal.");
      return;
    }
    
    if (editingId) {
      try {
        await api.post(`/dashboard/listings/${editingId}/inline-edit`, {
          title: editTitle,
          price: editPrice,
          discount_price: editDiscountPrice
        });
        
        setListings(listings.map(l => l.id === editingId ? {
          ...l,
          title: editTitle,
          price: editPrice,
          discount_price: editDiscountPrice
        } : l));
        setEditingId(null);
      } catch (e: any) {
        console.error("Erreur lors de la mise à jour:", e);
        const msg = e.response?.data?.message || e.response?.data?.error || "Une erreur est survenue lors de l'enregistrement.";
        alert(msg);
      }
    }
  };

  // Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; action: "delete" | "sold" | "bulk_delete" | "bulk_sold" | null; id: number | null }>({ isOpen: false, action: null, id: null });

  const confirmAction = (action: "delete" | "sold" | "bulk_delete" | "bulk_sold", id: number | null = null) => {
    setConfirmModal({ isOpen: true, action, id });
  };

  const executeAction = async () => {
    try {
      if (confirmModal.action === "delete" && confirmModal.id !== null) {
        await api.post(`/dashboard/listings/${confirmModal.id}/status`, { status: 'deleted' });
        setListings(listings.map(l => l.id === confirmModal.id ? { ...l, status: "deleted" } : l));
      } else if (confirmModal.action === "sold" && confirmModal.id !== null) {
        await api.post(`/dashboard/listings/${confirmModal.id}/status`, { status: 'sold' });
        setListings(listings.map(l => l.id === confirmModal.id ? { ...l, status: "sold" } : l));
      } else if (confirmModal.action === "bulk_sold") {
        await api.post(`/dashboard/listings/bulk-status`, { ids: selectedIds, status: 'sold' });
        setListings(listings.map(l => selectedIds.includes(l.id) ? { ...l, status: "sold" } : l));
        setSelectedIds([]);
      } else if (confirmModal.action === "bulk_delete") {
        await api.post(`/dashboard/listings/bulk-status`, { ids: selectedIds, status: 'deleted' });
        setListings(listings.map(l => selectedIds.includes(l.id) ? { ...l, status: "deleted" } : l));
        setSelectedIds([]);
      }
    } catch (e) {
      console.error("Erreur lors de l'action:", e);
      alert("Une erreur est survenue.");
    }
    setConfirmModal({ isOpen: false, action: null, id: null });
  };

  // Actions
  const handleMarkAsSold = (id: number) => {
    confirmAction("sold", id);
  };

  const handleDelete = (id: number) => {
    confirmAction("delete", id);
  };

  // Bulk Actions
  const handleBulkMarkAsSold = () => {
    confirmAction("bulk_sold");
  };

  const handleBulkDelete = () => {
    confirmAction("bulk_delete");
  };

  const handleApplyBulkDiscount = async () => {
    const pct = parseFloat(bulkDiscount);
    if (isNaN(pct) || pct <= 0 || pct >= 100) {
      alert("Entrez un pourcentage de réduction valide (ex: 20)");
      return;
    }
    
    try {
      await api.post(`/dashboard/listings/bulk-discount`, { ids: selectedIds, discount_percentage: pct });
      
      setListings(listings.map(l => {
        if (selectedIds.includes(l.id)) {
          const discounted = l.price * (1 - pct / 100);
          return { ...l, discount_price: Math.round(discounted * 100) / 100 };
        }
        return l;
      }));
      setSelectedIds([]);
      setBulkDiscount("");
    } catch (e) {
      console.error("Erreur lors de l'application de la remise:", e);
      alert("Une erreur est survenue.");
    }
  };

  return (
    <div className="space-y-10 font-sans">
      
      {/* 1. Header (Profil & Stats) */}
      <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-stretch">
        {/* Profile Card */}
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left gap-4 lg:w-1/3 justify-center">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-shrink-0">
              <div className="w-16 h-16 rounded-2xl bg-[#6D28D9] text-white flex items-center justify-center font-black text-2xl shadow-md border-2 border-white overflow-hidden">
                {getAvatarUrl() ? (
                  <img src={getAvatarUrl() as string} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  (user?.profile?.nickname || user?.name) ? (user?.profile?.nickname || user?.name)?.charAt(0).toUpperCase() : "U"
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 border-2 border-white rounded-full"></span>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-0.5">Bienvenue</p>
              <h1 className="text-2xl font-black text-gray-950 leading-tight">{user?.profile?.nickname || user?.name || "Utilisateur"}</h1>
              <p className="text-xs text-gray-500 font-medium">{user?.email || ""}</p>
            </div>
          </div>
          <div className="flex gap-2 w-full justify-center lg:justify-start">
            <Link href="/profile" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 font-bold text-xs hover:border-[#6D28D9] hover:text-[#6D28D9] transition-all">
              Mon profil
            </Link>
            <button onClick={() => logout()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 font-bold text-xs hover:border-red-300 hover:text-red-500 transition-all cursor-pointer">
              Déconnexion
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
          {[
            { value: activeCount, label: "Actives", icon: "📚", bg: "bg-violet-50 text-violet-600" },
            { value: soldCount, label: "Ventes", icon: "💰", bg: "bg-emerald-50 text-emerald-600" },
            { value: "0", label: "Favoris", icon: "❤️", bg: "bg-rose-50 text-rose-600" },
            { value: "0", label: "Commandes", icon: "🛒", bg: "bg-orange-50 text-orange-600" }
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-150 shadow-xs px-4 py-3.5 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">{stat.icon}</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{stat.label}</span>
              </div>
              <div className="text-2xl font-black text-gray-900 leading-none">{stat.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Listings Filter / Controls */}
      <div>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 border-b border-gray-100 pb-5">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-black text-gray-950">Mes annonces</h2>
            <button 
              onClick={handleToggleSelectAll}
              className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-xs text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <input 
                type="checkbox" 
                checked={selectedIds.length === filteredListings.length && filteredListings.length > 0} 
                onChange={() => {}} 
                className="rounded border-gray-300 text-[#6D28D9] focus:ring-[#6D28D9] pointer-events-none"
              />
              Tout cocher
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Local Search */}
            <div className="relative w-full sm:w-48 border border-gray-200 rounded-lg overflow-hidden bg-white shadow-xs">
              <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
                <Search className="h-4 w-4" />
              </span>
              <input 
                type="text" 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                placeholder="Rechercher..." 
                className="w-full text-xs border-none bg-transparent py-2 pl-8 pr-3 focus:outline-none"
              />
            </div>

            {/* Sort options */}
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs border border-gray-200 bg-white rounded-lg py-2 pl-2 pr-8 focus:outline-none text-gray-600 shadow-xs cursor-pointer"
            >
              <option value="created_at">Date d'ajout</option>
              <option value="price">Prix</option>
              <option value="title">Titre</option>
            </select>

            {/* Status Filter tabs */}
            <div className="flex bg-gray-100 rounded-lg p-0.5 w-full sm:w-auto">
              {[
                { val: "online", label: "En ligne" },
                { val: "offline", label: "Hors ligne" },
                { val: "all", label: "Tout" }
              ].map(opt => (
                <button
                  key={opt.val}
                  onClick={() => { setFilter(opt.val as any); setSelectedIds([]); }}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all text-center flex-1 sm:flex-none cursor-pointer ${
                    filter === opt.val ? "bg-white shadow-xs text-black" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* View Mode Toggle */}
            <div className="hidden sm:flex bg-gray-100 rounded-lg p-0.5">
              <button 
                onClick={() => setViewMode("cards")}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${viewMode === "cards" ? "bg-white shadow-xs text-black" : "text-gray-400 hover:text-gray-600"}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${viewMode === "table" ? "bg-white shadow-xs text-black" : "text-gray-400 hover:text-gray-600"}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <Link href="/annonces/create" className="w-full sm:w-auto bg-[#6D28D9] text-white font-bold px-4 py-2 rounded-lg text-xs hover:bg-violet-800 transition-all text-center shadow-xs flex items-center justify-center gap-1">
              <Plus className="h-4 w-4" /> Publier
            </Link>
          </div>
        </div>

        {/* 3. Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="bg-[#6D28D9]/5 border border-[#6D28D9]/20 rounded-xl p-3 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded bg-[#6D28D9] text-white text-xs font-bold">
                {selectedIds.length}
              </span>
              <span className="text-xs font-bold text-[#6D28D9]">Annonces sélectionnées</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Discount apply input */}
              <div className="flex items-center bg-white rounded-lg px-3 py-1.5 border border-gray-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-gray-400 mr-2">Remise</span>
                <input 
                  type="number" 
                  value={bulkDiscount} 
                  onChange={(e) => setBulkDiscount(e.target.value)} 
                  placeholder="%" 
                  className="w-10 text-xs text-[#6D28D9] font-bold border-none bg-transparent p-0 text-center focus:outline-none"
                  min="1" 
                  max="99"
                />
                <button 
                  onClick={handleApplyBulkDiscount}
                  className="text-gray-400 hover:text-[#6D28D9] p-0.5 cursor-pointer ml-1"
                  title="Appliquer la remise"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>

              {/* Sold trigger */}
              <button 
                onClick={handleBulkMarkAsSold}
                className="flex items-center gap-1.5 text-xs font-bold bg-white text-emerald-600 hover:bg-emerald-50 border border-gray-250 px-3.5 py-2 rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Marquer Vendu
              </button>

              {/* Delete trigger */}
              <button 
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 text-xs font-bold bg-white text-rose-600 hover:bg-rose-50 border border-gray-250 px-3.5 py-2 rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Retirer
              </button>
            </div>
          </div>
        )}

        {/* 4. Listings representation */}
        {filteredListings.length > 0 ? (
          <>
            {/* Table View */}
            <div className={`bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs mb-8 ${viewMode === "table" ? "hidden sm:block" : "hidden"}`}>
              <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-50 border-b border-gray-150 text-gray-500 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="px-6 py-4 w-10">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.length === filteredListings.length && filteredListings.length > 0} 
                          onChange={handleToggleSelectAll}
                          className="rounded border-gray-300 text-[#6D28D9] focus:ring-[#6D28D9] cursor-pointer"
                        />
                      </th>
                      <th className="px-6 py-4">Annonce</th>
                      <th className="px-6 py-4">Prix</th>
                      <th className="px-6 py-4">Statut</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4 text-right pr-8">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredListings.map((l) => {
                      const isSold = l.status === "sold";
                      const isEditing = editingId === l.id;

                      const coverUrl = primaryCoverUrl(l);

                      return (
                        <tr 
                          key={l.id} 
                          className={`hover:bg-violet-50/20 transition-colors ${selectedIds.includes(l.id) ? "bg-violet-50/30" : ""}`}
                        >
                          <td className="px-6 py-4">
                            <input 
                              type="checkbox" 
                              checked={selectedIds.includes(l.id)} 
                              onChange={() => handleToggleSelect(l.id)}
                              className="rounded border-gray-300 text-[#6D28D9] focus:ring-[#6D28D9] cursor-pointer"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-start gap-3">
                              <div className="w-10 flex-shrink-0 flex flex-col items-center gap-1">
                                {coverUrl ? (
                                  <Link href={buildListingUrl(l)}>
                                    <img 
                                      src={coverUrl} 
                                      alt={l.title} 
                                      onError={(e) => handleCoverError(e, l)}
                                      className="w-10 h-14 object-contain rounded border border-gray-150 cursor-pointer"
                                    />
                                  </Link>
                                ) : (
                                  <Link href={buildListingUrl(l)} className="w-10 h-14 bg-gray-50 flex items-center justify-center rounded border border-gray-150 text-gray-300 cursor-pointer hover:border-[#6D28D9] transition-colors">
                                    <BookOpen className="w-5 h-5 stroke-1" />
                                  </Link>
                                )}
                                {l.book_condition === "neuf" ? (
                                  <span className="text-[8px] bg-orange-500 text-white font-bold px-1 rounded-sm uppercase scale-90">Neuf</span>
                                ) : (
                                  <span className="text-[8px] bg-teal-600 text-white font-bold px-1 rounded-sm uppercase scale-90">Occas</span>
                                )}
                              </div>
                              <div className="flex-1">
                                {isEditing ? (
                                  <input 
                                    type="text" 
                                    value={editTitle} 
                                    onChange={(e) => setEditTitle(e.target.value)} 
                                    className="w-full text-xs py-1 border border-gray-300 rounded px-2 focus:ring-1 focus:ring-[#6D28D9]"
                                  />
                                ) : (
                                  <div>
                                    <div className="flex items-center gap-1.5 group/title">
                                      <Link href={buildListingUrl(l)} className="font-bold text-gray-950 text-sm block leading-snug hover:text-[#6D28D9]">
                                        {l.title}
                                      </Link>
                                      <button 
                                        onClick={() => handleStartEdit(l)}
                                        className="text-gray-300 hover:text-[#6D28D9] p-0.5 transition-colors cursor-pointer opacity-0 group-hover/title:opacity-100"
                                      >
                                        <Edit className="w-3 h-3" />
                                      </button>
                                    </div>
                                    <span className="text-[10px] text-gray-400 block mt-0.5">ISBN : {l.isbn_13 || "N/A"}</span>
                                    {l.category && (
                                      <span className="text-[9px] text-violet-500 font-bold block mt-0.5">{l.category.name_fr}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {isEditing ? (
                              <div className="flex flex-col gap-1 w-24">
                                <input 
                                  type="number" 
                                  value={editPrice} 
                                  onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)} 
                                  placeholder="Normal" 
                                  className="w-full text-xs py-1 border border-gray-300 rounded px-2"
                                />
                                <input 
                                  type="number" 
                                  value={editDiscountPrice ?? ""} 
                                  onChange={(e) => setEditDiscountPrice(e.target.value ? parseFloat(e.target.value) : null)} 
                                  placeholder="Réduit" 
                                  className="w-full text-xs py-1 border border-gray-300 rounded px-2"
                                />
                                <div className="flex gap-1 mt-1 justify-end">
                                  <button onClick={handleSaveEdit} className="text-[9px] bg-[#6D28D9] text-white px-2 py-0.5 rounded cursor-pointer font-bold">OK</button>
                                  <button onClick={() => setEditingId(null)} className="text-[9px] bg-gray-250 text-gray-700 px-2 py-0.5 rounded cursor-pointer font-bold">X</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 group">
                                <div>
                                  {l.discount_price ? (
                                    <>
                                      <span className="text-[10px] text-gray-400 line-through mr-1">{Number(l.price).toFixed(2)}</span>
                                      <span className="font-extrabold text-[#6D28D9] text-sm block">{Number(l.discount_price).toFixed(2)} MAD</span>
                                    </>
                                  ) : (
                                    <span className="font-extrabold text-gray-900 text-sm block">{Number(l.price).toFixed(2)} MAD</span>
                                  )}
                                </div>
                                <button 
                                  onClick={() => handleStartEdit(l)}
                                  className="text-gray-300 hover:text-[#6D28D9] p-1 transition-colors cursor-pointer"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {(() => { const b = statusBadge(l); return (
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${b.className}`}>{b.label}</span>
                            ); })()}
                          </td>
                          <td className="px-6 py-4 text-gray-400 font-medium">
                            {new Date(l.created_at).toLocaleDateString("fr-FR")}
                          </td>
                          <td className="px-6 py-4 text-right pr-6">
                            <div className="flex gap-2 justify-end">
                              {!isSold && (
                                <button 
                                  onClick={() => handleMarkAsSold(l.id)}
                                  className="p-1.5 text-gray-400 hover:text-emerald-600 rounded-md hover:bg-emerald-50 transition-colors cursor-pointer" 
                                  title="Marquer comme vendu"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                              )}
                              <Link 
                                href={`/annonces/${l.id}/edit`}
                                className="p-1.5 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors cursor-pointer" 
                                title="Modifier"
                              >
                                <Edit className="w-4 h-4" />
                              </Link>
                              <button 
                                onClick={() => handleDelete(l.id)}
                                className="p-1.5 text-gray-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer" 
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            {/* Cards View (Responsive default) */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 ${viewMode === "cards" ? "block" : "block sm:hidden"}`}>
              {filteredListings.map((l) => {
                  const isSold = l.status === "sold";
                  const coverUrl = primaryCoverUrl(l);

                  return (
                    <div 
                      key={l.id} 
                      className={`bg-white rounded-xl border border-gray-150 p-4 flex flex-col gap-3 relative shadow-xs hover:shadow-md transition-shadow ${
                        selectedIds.includes(l.id) ? "border-[#6D28D9]/40 bg-violet-50/10" : ""
                      }`}
                    >
                      {/* Checkbox badge */}
                      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.includes(l.id)} 
                          onChange={() => handleToggleSelect(l.id)}
                          className="rounded border-gray-300 text-[#6D28D9] focus:ring-[#6D28D9] cursor-pointer"
                        />
                        {l.book_condition === "neuf" ? (
                          <span className="text-[8px] bg-orange-500 text-white font-bold px-1.5 py-0.5 rounded-xs uppercase tracking-wide">Neuf</span>
                        ) : (
                          <span className="text-[8px] bg-teal-600 text-white font-bold px-1.5 py-0.5 rounded-xs uppercase tracking-wide">Occasion</span>
                        )}
                      </div>

                      {/* Status flag */}
                      <div className="absolute top-3 right-3">
                        {(() => { const b = statusBadge(l); return (
                          <span className={`text-[9px] font-bold px-2 py-0.5 border rounded-sm ${b.className}`}>{b.label}</span>
                        ); })()}
                      </div>

                      {/* Image cover & Details */}
                      <div className="flex gap-3 pt-6 border-b border-gray-100 pb-3">
                        <Link href={buildListingUrl(l)} className="w-12 h-16 flex-shrink-0 bg-gray-50 flex items-center justify-center rounded border border-gray-150 text-gray-300 cursor-pointer hover:border-[#6D28D9] transition-colors">
                          {coverUrl ? (
                            <img src={coverUrl} alt={l.title} onError={(e) => handleCoverError(e, l)} className="w-full h-full object-contain" />
                          ) : (
                            <BookOpen className="w-5 h-5 stroke-1" />
                          )}
                        </Link>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 group/title">
                            <Link href={buildListingUrl(l)} className="font-bold text-gray-950 text-sm truncate hover:text-[#6D28D9]">{l.title}</Link>
                            <button 
                              onClick={() => handleStartEdit(l)}
                              className="text-gray-300 hover:text-[#6D28D9] p-0.5 transition-colors cursor-pointer"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="text-[10px] text-gray-400 block mt-0.5 font-mono">ISBN: {l.isbn_13 || "N/A"}</span>
                          {l.category && (
                            <span className="text-[9px] text-[#6D28D9] font-bold block mt-0.5">{l.category.name_fr}</span>
                          )}
                        </div>
                      </div>

                      {/* Price & Actions */}
                      <div className="flex items-center justify-between mt-auto">
                        <div>
                          {l.discount_price ? (
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] text-gray-400 line-through block leading-none mb-0.5">{Number(l.price).toFixed(2)}</span>
                              <span className="font-extrabold text-[#6D28D9] text-base">{Number(l.discount_price).toFixed(2)} MAD</span>
                            </div>
                          ) : (
                            <span className="font-extrabold text-gray-950 text-base">{Number(l.price).toFixed(2)} MAD</span>
                          )}
                        </div>

                        <div className="flex gap-1.5">
                          {!isSold && (
                            <button 
                              onClick={() => confirmAction("sold", l.id)}
                              className="p-1.5 border border-gray-150 hover:border-emerald-600 hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 rounded-lg transition-colors cursor-pointer"
                              title="Marquer comme vendu"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <Link 
                            href={`/annonces/${l.id}/edit`}
                            className="p-1.5 border border-gray-150 hover:border-blue-600 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-lg transition-colors cursor-pointer"
                            title="Modifier"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Link>
                          <button 
                            onClick={() => confirmAction("delete", l.id)}
                            className="p-1.5 border border-gray-150 hover:border-rose-600 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            title="Retirer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-150 shadow-xs overflow-hidden mt-6">
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <ShieldAlert className="w-16 h-16 text-gray-300 stroke-1 mb-4" />
              <h3 className="text-lg font-black text-gray-950 mb-1">Aucune annonce trouvée</h3>
              <p className="text-xs text-gray-500 max-w-sm mb-6 leading-relaxed">
                Il n'y a pas d'annonce correspondant à vos critères de recherche ou de filtre pour le moment.
              </p>
              <Link href="/annonces/create" className="bg-[#6D28D9] text-white font-bold px-6 py-2.5 rounded-xl text-xs hover:bg-violet-800 transition-all">
                Créer une annonce
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in-95 duration-200 border border-gray-100">
            <div className="flex flex-col items-center text-center">
              {confirmModal.action === "delete" || confirmModal.action === "bulk_delete" ? (
                <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mb-4 border border-rose-100">
                  <Trash2 className="w-6 h-6 text-rose-500" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-4 border border-emerald-100">
                  <CheckCircle className="w-6 h-6 text-emerald-500" />
                </div>
              )}
              
              <h3 className="text-lg font-black text-gray-900 mb-2">
                {confirmModal.action === "delete" || confirmModal.action === "bulk_delete" ? "Supprimer l'annonce ?" : "Marquer comme vendu ?"}
              </h3>
              
              <p className="text-xs text-gray-500 mb-6 px-2">
                {confirmModal.action === "delete" ? "Cette action retirera l'annonce de la plateforme. Êtes-vous sûr ?" : 
                 confirmModal.action === "bulk_delete" ? "Voulez-vous vraiment retirer les annonces sélectionnées ?" :
                 confirmModal.action === "sold" ? "Bravo pour cette vente ! L'annonce n'apparaîtra plus dans les résultats de recherche." :
                 "Marquer ces annonces comme vendues ? Elles n'apparaîtront plus dans les résultats de recherche."}
              </p>
              
              <div className="flex items-center gap-3 w-full">
                <button 
                  onClick={() => setConfirmModal({ isOpen: false, action: null, id: null })}
                  className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button 
                  onClick={executeAction}
                  className={`flex-1 py-2.5 font-bold text-xs rounded-xl text-white transition-colors cursor-pointer shadow-sm ${
                    confirmModal.action === "delete" || confirmModal.action === "bulk_delete" 
                      ? "bg-rose-500 hover:bg-rose-600 border border-rose-600" 
                      : "bg-emerald-500 hover:bg-emerald-600 border border-emerald-600"
                  }`}
                >
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
