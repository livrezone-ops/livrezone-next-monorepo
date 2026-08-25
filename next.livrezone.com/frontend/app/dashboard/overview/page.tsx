"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CreditCard,
  Crown,
  MessageSquare,
  Search,
  TrendingUp,
} from "lucide-react";
import api from "@/lib/axios";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface Stats {
  total: number;
  active: number;
  sold: number;
  demandes: number;
}

export default function OverviewPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [listings, orders] = await Promise.all([
          api.get("/dashboard/listings", { params: { filter: "all", limit: 1 } }),
          api.get("/orders", { params: { page: 1, limit: 1 } }),
        ]);
        if (cancelled) return;
        setStats({
          total: listings.data.meta?.total ?? 0,
          active: listings.data.meta?.active_count ?? 0,
          sold: listings.data.meta?.sold_count ?? 0,
          demandes: orders.data.meta?.total ?? 0,
        });
      } catch {
        if (!cancelled) setStats({ total: 0, active: 0, sold: 0, demandes: 0 });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const tiles = [
    { label: "Annonces actives", value: stats?.active ?? 0, icon: BookOpen, href: "/dashboard" },
    { label: "Ventes réalisées", value: stats?.sold ?? 0, icon: TrendingUp, href: "/dashboard?filter=all" },
    { label: "Mes demandes", value: stats?.demandes ?? 0, icon: Search, href: "/dashboard/demandes" },
    { label: "Messages non lus", value: user?.unread_notifications_count ?? 0, icon: MessageSquare, href: "/dashboard/messages" },
  ];

  const subscription = user?.profile?.subscription_type ?? "free";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl lg:text-3xl font-black text-[#1a0a40]">
          Bonjour {user?.profile?.nickname || user?.name || ""} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Vue d&apos;ensemble de votre activité sur LivreZone.
        </p>
      </header>

      {/* Bandeau abonnement */}
      <div
        className={`rounded-2xl border p-5 flex items-center justify-between gap-4 ${
          subscription === "free"
            ? "bg-gradient-to-r from-violet-50 to-white border-violet-100"
            : "bg-[#1a0a40] text-white border-[#6D28D9]/40"
        }`}
      >
        <div className="flex items-center gap-3">
          <Crown className={`h-8 w-8 ${subscription === "free" ? "text-[#6D28D9]" : "text-amber-300"}`} />
          <div>
            <p className="font-black text-sm uppercase tracking-wide">
              Abonnement {subscription}
            </p>
            <p className={`text-xs mt-0.5 ${subscription === "free" ? "text-gray-600" : "text-violet-200"}`}>
              {subscription === "free"
                ? "Passez en Pro ou Premium pour plus de visibilité et de fonctionnalités."
                : "Merci de votre confiance. Gérez vos échéances depuis Paiements."}
            </p>
          </div>
        </div>
        <Link
          href={subscription === "free" ? "/tarification" : "/dashboard/paiements"}
          className="shrink-0 bg-[#6D28D9] hover:bg-violet-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all active:scale-[0.98]"
        >
          {subscription === "free" ? "Voir les offres" : "Gérer"}
        </Link>
      </div>

      {/* Tuiles statistiques */}
      {!user ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#6D28D9]" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {tiles.map(({ label, value, icon: Icon, href }) => (
            <Link
              key={label}
              href={href}
              className="bg-white rounded-2xl border border-gray-100 p-4 lg:p-5 hover:border-[#6D28D9]/40 hover:shadow-sm transition-all group"
            >
              <Icon className="h-5 w-5 text-[#6D28D9]" />
              <p className="text-2xl lg:text-3xl font-black text-[#1a0a40] mt-2">{value}</p>
              <p className="text-xs text-gray-500 font-bold mt-1 group-hover:text-[#6D28D9] transition-colors">
                {label}
              </p>
            </Link>
          ))}
        </div>
      )}

      {/* Raccourcis */}
      <section className="grid md:grid-cols-2 gap-3">
        <Link
          href="/annonces/create"
          className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 hover:border-[#6D28D9]/40 transition-all group"
        >
          <span className="bg-violet-50 p-3 rounded-xl"><BookOpen className="h-6 w-6 text-[#6D28D9]" /></span>
          <div>
            <p className="font-black text-sm text-[#1a0a40]">Vendre un livre</p>
            <p className="text-xs text-gray-500">Publiez une nouvelle annonce en quelques minutes.</p>
          </div>
        </Link>
        <Link
          href="/dashboard/demandes/create"
          className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 hover:border-[#6D28D9]/40 transition-all group"
        >
          <span className="bg-violet-50 p-3 rounded-xl"><Search className="h-6 w-6 text-[#6D28D9]" /></span>
          <div>
            <p className="font-black text-sm text-[#1a0a40]">Chercher un livre</p>
            <p className="text-xs text-gray-500">Déposez une demande, les vendeurs viennent à vous.</p>
          </div>
        </Link>
        <Link
          href="/dashboard/paiements"
          className="md:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 hover:border-[#6D28D9]/40 transition-all group"
        >
          <span className="bg-violet-50 p-3 rounded-xl"><CreditCard className="h-6 w-6 text-[#6D28D9]" /></span>
          <div>
            <p className="font-black text-sm text-[#1a0a40]">Paiements & Abonnement</p>
            <p className="text-xs text-gray-500">Historique de paiements et suivi de votre abonnement.</p>
          </div>
        </Link>
      </section>
    </div>
  );
}
