"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CreditCard,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import api from "@/lib/axios";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | null;
}

/**
 * Shell de l'espace administration : même mécanique que le dashboard
 * (sidebar rétractable mobile), avec accents orange pour le distinguer.
 */
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pendingBadges, setPendingBadges] = useState<{ listings: number | null; demandes: number | null }>({
    listings: null,
    demandes: null,
  });
  const pathname = usePathname();

  // Badges de modération : éléments en attente de validation
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [listings, orders] = await Promise.all([
          api.get("/admin/listings", { params: { filter: "pending", limit: 1 } }),
          api.get("/admin/orders", { params: { status: "pending_admin", limit: 1 } }),
        ]);
        if (!cancelled) {
          setPendingBadges({
            listings: listings.data.meta?.total ?? 0,
            demandes: orders.data.meta?.status_counts?.pending ?? 0,
          });
        }
      } catch {
        // Silencieux : les badges sont indicatifs
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const navItems: NavItem[] = [
    { href: "/admin", label: "Annonces", icon: BookOpen, badge: pendingBadges.listings },
    { href: "/admin/demandes", label: "Demandes", icon: Search, badge: pendingBadges.demandes },
    { href: "/admin/utilisateurs", label: "Utilisateurs", icon: Users },
    { href: "/admin/paiements", label: "Paiements & Promos", icon: CreditCard },
    { href: "/admin/hero", label: "Messages Hero", icon: Settings2 },
  ];

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setOpen(false)}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all group ${
          active
            ? "bg-orange-50 text-[#EA580C] font-black border-l-4 border-[#F97316]"
            : "text-gray-700 font-bold hover:bg-gray-50 hover:text-[#EA580C]"
        }`}
      >
        <Icon
          className={`h-5 w-5 shrink-0 ${active ? "text-[#EA580C]" : "text-gray-400 group-hover:text-[#EA580C]"}`}
        />
        <span className="flex-1 truncate">{item.label}</span>
        {!!item.badge && (
          <span className="min-w-[20px] h-[20px] px-1 bg-[#F97316] text-white text-[11px] font-black rounded-full flex items-center justify-center">
            {item.badge > 99 ? "99+" : item.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Bouton toggle mobile */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-1/3 left-0 z-40 bg-[#F97316] text-white py-2.5 px-3 rounded-r-xl shadow-2xl border-y border-r border-orange-300/50 flex items-center gap-2 hover:bg-[#EA580C] active:scale-95 transition-all cursor-pointer"
        aria-label="Ouvrir le menu d'administration"
      >
        <SlidersHorizontal className="h-4 w-4 text-orange-100" />
        <span className="text-xs font-bold tracking-wide">Admin</span>
      </button>

      {/* Overlay mobile */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          aria-hidden="true"
        />
      )}

      <div className="flex w-[95%] max-w-[1500px] mx-auto gap-0 lg:gap-6 lg:py-8">
        {/* Sidebar : drawer sur mobile, colonne fixe en desktop */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-[250px] bg-white overflow-y-auto transition-transform duration-300 ease-in-out ${
            open ? "translate-x-0" : "-translate-x-full"
          } lg:relative lg:z-0 lg:w-[250px] lg:flex-shrink-0 lg:translate-x-0 lg:self-start lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] rounded-none lg:rounded-2xl border-r lg:border border-gray-100 shadow-2xl lg:shadow-sm`}
        >
          {/* Header drawer mobile */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 lg:hidden bg-orange-50/50">
            <span className="font-black text-lg text-[#1a0a40] flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#F97316]" />
              Administration
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-500 hover:text-black"
              aria-label="Fermer le menu"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-3 space-y-1" aria-label="Navigation d'administration">
            <p className="hidden lg:block px-3 pt-2 pb-4 text-xs uppercase tracking-wider text-gray-400 font-bold">
              Administration LivreZone
            </p>
            {navItems.map(renderItem)}
          </nav>

          <div className="p-3 border-t border-gray-100">
            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-2 w-full text-gray-600 hover:text-[#EA580C] hover:bg-gray-50 font-bold text-xs py-2.5 rounded-xl transition-all"
            >
              ← Retour à mon espace
            </Link>
          </div>
        </aside>

        {/* Contenu */}
        <main className="flex-1 min-w-0 py-6 lg:py-0">{children}</main>
      </div>
    </div>
  );
}
