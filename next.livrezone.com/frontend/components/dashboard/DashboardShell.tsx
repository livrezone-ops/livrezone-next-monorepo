"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  CreditCard,
  Heart,
  LayoutDashboard,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  User as UserIcon,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | null;
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard" || pathname.startsWith("/dashboard/annonces")
      : pathname.startsWith(href);

  const mainNav: NavItem[] = [
    { href: "/dashboard/overview", label: "Vue d'ensemble", icon: LayoutDashboard },
    { href: "/dashboard", label: "Mes annonces", icon: BookOpen },
    { href: "/dashboard/demandes", label: "Mes demandes", icon: Search },
    { href: "/dashboard/messages", label: "Messagerie", icon: MessageSquare },
    {
      href: "/dashboard/notifications",
      label: "Notifications",
      icon: Bell,
      badge: user?.unread_notifications_count ?? null,
    },
    { href: "/dashboard/paiements", label: "Paiements & Abonnement", icon: CreditCard },
  ];

  const secondaryNav: NavItem[] = [
    { href: "/profile", label: "Mon profil", icon: UserIcon },
    { href: "/favorites", label: "Mes favoris", icon: Heart },
  ];

  if (user?.is_admin) {
    secondaryNav.push({ href: "/admin", label: "Administration", icon: ShieldCheck });
  }

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
            ? "bg-violet-50 text-[#6D28D9] font-black border-l-4 border-[#6D28D9]"
            : "text-gray-700 font-bold hover:bg-gray-50 hover:text-[#6D28D9]"
        }`}
      >
        <Icon className={`h-5 w-5 shrink-0 ${active ? "text-[#6D28D9]" : "text-gray-400 group-hover:text-[#6D28D9]"}`} />
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
      {/* Bouton toggle mobile (même pattern que FilterSidebar) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-1/3 left-0 z-40 bg-[#1a0a40] text-white py-2.5 px-3 rounded-r-xl shadow-2xl border-y border-r border-[#6D28D9]/40 flex items-center gap-2 hover:bg-[#6D28D9] active:scale-95 transition-all cursor-pointer"
        aria-label="Ouvrir le menu du tableau de bord"
      >
        <SlidersHorizontal className="h-4 w-4 text-violet-300" />
        <span className="text-xs font-bold tracking-wide">Menu</span>
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
          } lg:relative lg:z-0 lg:w-[250px] lg:flex-shrink-0 lg:translate-x-0 lg:shadow-none shadow-2xl lg:self-start lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] rounded-none lg:rounded-2xl border-r lg:border border-gray-100`}
        >
          {/* Header drawer mobile */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 lg:hidden bg-gray-50">
            <span className="font-black text-lg text-[#1a0a40]">Mon espace</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-500 hover:text-black"
              aria-label="Fermer le menu"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-3 space-y-1" aria-label="Navigation du tableau de bord">
            {user && (
              <div className="px-3 pt-2 pb-4 border-b border-gray-100 mb-3">
                <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">Connecté</p>
                <p className="font-black text-sm text-[#1a0a40] truncate mt-1">
                  {user.profile?.nickname || user.name}
                </p>
                {user.profile?.subscription_type && (
                  <span
                    className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
                      user.profile.subscription_type === "free"
                        ? "bg-gray-100 text-gray-600"
                        : "bg-violet-100 text-[#6D28D9]"
                    }`}
                  >
                    {user.profile.subscription_type}
                  </span>
                )}
              </div>
            )}

            {mainNav.map(renderItem)}

            <div className="pt-4 pb-2 px-3 border-t border-gray-100 mt-3">
              <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">Compte</p>
            </div>
            {secondaryNav.map(renderItem)}
          </nav>

          <div className="p-3 border-t border-gray-100">
            <Link
              href="/annonces/create"
              className="flex items-center justify-center gap-2 w-full bg-[#6D28D9] hover:bg-violet-800 text-white font-black text-sm py-3 rounded-xl shadow-sm transition-all active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              Publier une annonce
            </Link>
          </div>
        </aside>

        {/* Contenu */}
        <main className="flex-1 min-w-0 py-6 lg:py-0">{children}</main>
      </div>
    </div>
  );
}
