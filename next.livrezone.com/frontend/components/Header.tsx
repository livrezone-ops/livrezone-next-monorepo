"use client";

import React, { useState, useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Menu, X, Search, Heart, ShoppingCart, User, 
  Settings, LogOut, MessageSquare, BookOpen, ShieldCheck
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCommerce } from "@/lib/commerce-store";
import { useQuery } from "@tanstack/react-query";
import { listThreads } from "@/lib/chat-api";
import {
  getChatActive,
  subscribeChatActive,
} from "@/lib/chat-active";
import SaveCartModal from "@/components/SaveCartModal";
import { CATEGORIES } from "@/lib/reference-data";
import Logo from "@/components/Logo";
import HeaderSearch from "@/components/HeaderSearch";

const NAV_LABELS: Record<string, string> = {
  SCOLAIRE: "Rentrée Scolaire",
  JEUNESSE: "Enfants",
  VIE_PRATIQUE: "Vie Pratique",
};

export default function Header() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [lang, setLang] = useState("FR");
  const [avatarError, setAvatarError] = useState(false);

  const { user, isAuthenticated: isLoggedIn, logout } = useAuth();
  const { wishlistCount, cartCount } = useCommerce();

  // Compteur de messages non lus (même cache que la page messagerie).
  const { data: unreadCount } = useQuery({
    queryKey: ["chat", "threads"],
    queryFn: listThreads,
    select: (d) => d?.total_unread ?? 0,
    enabled: isLoggedIn,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const unreadMessages = unreadCount ?? 0;
  // Pastille masquée uniquement quand une conversation de chat est ouverte.
  const chatActive = useSyncExternalStore(
    subscribeChatActive,
    getChatActive,
    () => false
  );

  const getAvatarUrl = () => {
    if (!user?.profile?.logo) return null;
    if (user.profile.logo.startsWith('http')) return user.profile.logo;
    return `https://api-next.livrezone.com${user.profile.logo}`;
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "Annonces", href: "/annonces" },
    ...CATEGORIES.map((c) => ({
      label: NAV_LABELS[c.code] ?? c.name,
      href: `/annonces?category=${c.code}`,
    })),
  ];

  return (
    <header
      className={`relative z-50 bg-white border-b border-gray-100 transition-all duration-200 ${
        scrolled ? "shadow-md py-1" : "py-0"
      }`}
    >
      {/* TOPBAR */}
      <div className="bg-[#1a0a40] text-white py-2.5 sm:py-3 text-xs transition-all duration-200">
        <div className="w-full px-3 sm:px-6 lg:max-w-7xl lg:mx-auto flex justify-between items-center gap-3">
          {/* Message de bienvenue */}
          <div className="text-violet-200 text-xs sm:text-[13px] font-medium truncate">
            Bienvenue sur <strong className="text-white font-bold">LivreZone</strong>
          </div>

          {/* Bouton Orange Vendre un livre */}
          <Link
            href="/annonces/create"
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg bg-[#F97316] hover:bg-[#ea630a] text-white font-bold text-xs normal-case tracking-normal shadow-sm hover:shadow transition-all active:scale-[0.98] shrink-0"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Vendre un livre</span>
          </Link>
        </div>
      </div>

      {/* MAIN HEADER BAR */}
      <div className="w-full px-3 sm:px-6 lg:max-w-7xl lg:mx-auto h-[68px] sm:h-[78px] flex items-center justify-between gap-2 sm:gap-4 lg:gap-6 relative">
        
        {/* Hamburger Mobile */}
        <button 
          onClick={() => setMenuOpen(!menuOpen)} 
          className="lg:hidden shrink-0 text-black hover:text-[#6D28D9] transition-colors p-1"
          aria-label="Menu"
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>

        {/* LOGO */}
        <Logo size="md" href="/" className="shrink-0" />

        {/* RECHERCHE DESKTOP (Simplifiée : livres en vente uniquement) */}
        <HeaderSearch />

        {/* ICONS CONTAINER */}
        <div className="flex items-center gap-2 sm:gap-3.5 lg:gap-5 shrink-0">
          {/* Search Toggle Mobile */}
          <button 
            onClick={() => setSearchOpen(!searchOpen)} 
            className="lg:hidden text-black hover:text-[#6D28D9] transition-colors p-1"
            aria-label="Recherche"
          >
            <Search className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>

          {/* Wishlist */}
          <Link href="/favorites" className="hidden sm:block relative text-black hover:text-[#6D28D9] transition-colors p-1">
            <Heart className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
            {wishlistCount > 0 && (
              <span className="absolute -top-1 -right-1.5 bg-[#6D28D9] text-white text-[10px] font-black rounded-full h-4.5 w-4.5 flex items-center justify-center shadow-sm">
                {wishlistCount}
              </span>
            )}
          </Link>

          {/* Cart */}
          <Link href="/cart" className="relative text-black hover:text-[#6D28D9] transition-colors p-1">
            <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1.5 bg-[#6D28D9] text-white text-[10px] font-black rounded-full h-4.5 w-4.5 flex items-center justify-center shadow-sm">
                {cartCount}
              </span>
            )}
          </Link>

          {/* USER MENU */}
          <div className="relative">
            {isLoggedIn ? (
              <div className="relative">
                <button 
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-1 focus:outline-none group cursor-pointer"
                >
                  {!avatarError && getAvatarUrl() ? (
                    <img 
                      src={getAvatarUrl() as string} 
                      alt="Avatar" 
                      className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full border-2 border-gray-100 group-hover:border-[#6D28D9] transition-all object-cover shadow-xs" 
                      onError={() => setAvatarError(true)} 
                    />
                  ) : (
                    <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full border-2 border-gray-100 group-hover:border-[#6D28D9] transition-all object-cover shadow-xs bg-[#6D28D9] text-white flex items-center justify-center font-bold text-xs sm:text-sm">
                      {(user?.profile?.nickname || user?.name) ? (user?.profile?.nickname || user?.name)?.charAt(0).toUpperCase() : "U"}
                    </div>
                  )}
                  {unreadMessages > 0 && !chatActive && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 sm:h-3.5 sm:w-3.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 sm:h-3.5 sm:w-3.5 bg-red-500 border-2 border-white"></span>
                    </span>
                  )}
                </button>
                
                {userMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-3 w-56 bg-white border border-gray-100 shadow-xl rounded-lg overflow-hidden z-50 text-[13px] text-black animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                      <p className="font-bold text-gray-900 truncate">{user?.profile?.nickname || user?.name}</p>
                      <p className="text-[11px] text-gray-500 truncate">{user?.email}</p>
                    </div>
                    <Link 
                      href="/dashboard/messages" 
                      onClick={() => setUserMenuOpen(false)}
                      className="px-4 py-2.5 hover:bg-gray-50 hover:text-[#6D28D9] transition-colors flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-gray-400" />
                        Ma messagerie
                      </span>
                      {unreadMessages > 0 && !chatActive && (
                        <span className="bg-[#6D28D9] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {unreadMessages}
                        </span>
                      )}
                    </Link>
                    <Link 
                      href="/dashboard" 
                      onClick={() => setUserMenuOpen(false)}
                      className="px-4 py-2.5 hover:bg-gray-50 hover:text-[#6D28D9] transition-colors flex items-center gap-2"
                    >
                      <BookOpen className="h-4 w-4 text-gray-400" />
                      Mon espace
                    </Link>
                    {user?.is_admin && (
                      <Link 
                        href="/admin" 
                        onClick={() => setUserMenuOpen(false)}
                        className="px-4 py-2.5 hover:bg-gray-50 hover:text-[#6D28D9] transition-colors flex items-center gap-2"
                      >
                        <ShieldCheck className="h-4 w-4 text-gray-400" />
                        Administration
                      </Link>
                    )}
                    <Link 
                      href="/favorites" 
                      onClick={() => setUserMenuOpen(false)}
                      className="px-4 py-2.5 hover:bg-gray-50 hover:text-[#6D28D9] transition-colors flex items-center gap-2"
                    >
                      <Heart className="h-4 w-4 text-gray-400" />
                      Mes favoris
                    </Link>
                    <Link 
                      href="/profile" 
                      onClick={() => setUserMenuOpen(false)}
                      className="px-4 py-2.5 hover:bg-gray-50 hover:text-[#6D28D9] transition-colors flex items-center gap-2 border-b border-gray-100"
                    >
                      <Settings className="h-4 w-4 text-gray-400" />
                      Paramètres
                    </Link>
                    <button 
                      onClick={() => {
                        logout();
                        setUserMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-red-50 hover:text-red-600 text-gray-700 transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut className="h-4 w-4 text-gray-400 group-hover:text-red-600" />
                      Déconnexion
                    </button>
                  </div>
                  </>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="text-black hover:text-[#6D28D9] transition-colors p-1"
                aria-label="Connexion"
              >
                <User className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
              </Link>
            )}
          </div>
        </div>

        {/* SEARCH BAR MOBILE (DROPDOWN AVEC AUTO-FERMETURE APRÈS 5S D'INACTIVITÉ OU CLIC EXTÉRIEUR) */}
        {searchOpen && (
          <>
            {/* Backdrop pour clic extérieur */}
            <div 
              className="fixed inset-0 z-30 lg:hidden"
              onClick={() => setSearchOpen(false)}
            />
            <div className="absolute top-full left-0 w-full bg-white border-b border-gray-200 p-3 z-40 lg:hidden shadow-lg animate-in slide-in-from-top-2 duration-150">
              <HeaderSearch isMobile={true} onCloseMobile={() => setSearchOpen(false)} />
            </div>
          </>
        )}
      </div>

      {/* MOBILE DRAWER SIDEBAR */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div 
            onClick={() => setMenuOpen(false)} 
            className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
          ></div>
          <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-2xl flex flex-col z-50 animate-in slide-in-from-left duration-200">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <span className="font-black text-xl tracking-tight text-black">LivreZone</span>
              <button 
                onClick={() => setMenuOpen(false)} 
                className="text-gray-500 hover:text-black p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-4">
              <ul className="flex flex-col text-[16px] sm:text-[17px] font-bold text-gray-900 tracking-tight">
                {navLinks.map((link) => (
                  <li key={link.label}>
                    <Link 
                      href={link.href} 
                      onClick={() => setMenuOpen(false)}
                      className="block px-6 py-4 hover:bg-violet-50 hover:text-[#6D28D9] transition-all border-l-4 border-transparent hover:border-[#6D28D9]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex gap-4 justify-center">
              <Link 
                href="/favorites"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-[#6D28D9] font-semibold"
              >
                <Heart className="h-4 w-4" /> Favoris
              </Link>
              <span className="text-gray-300">|</span>
              <Link 
                href="/cart"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-[#6D28D9] font-semibold"
              >
                <ShoppingCart className="h-4 w-4" /> Panier
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* NAVIGATION DESKTOP BAR */}
      <nav className="hidden lg:block border-t border-gray-100 bg-white">
        <div className="w-[90%] max-w-7xl mx-auto">
          <ul className="flex items-center justify-center gap-6 xl:gap-8 h-[56px] text-[15px] xl:text-[16px] font-bold text-gray-900 tracking-tight">
            {navLinks.map((link) => (
              <li key={link.label}>
                <Link 
                  href={link.href} 
                  className="hover:text-[#6D28D9] transition-colors relative py-3 group whitespace-nowrap"
                >
                  {link.label}
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[#6D28D9] transition-all duration-200 group-hover:w-full"></span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <SaveCartModal />
    </header>
  );
}
