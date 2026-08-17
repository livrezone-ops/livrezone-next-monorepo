"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Menu, X, Search, Heart, ShoppingCart, User, 
  Settings, LogOut, MessageSquare, BookOpen, Inbox
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCommerce } from "@/lib/commerce-store";
import SaveCartModal from "@/components/SaveCartModal";
import { CATEGORIES } from "@/lib/reference-data";

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

  const { user, isAuthenticated: isLoggedIn, logout } = useAuth();
  const { wishlistCount, cartCount } = useCommerce();

  const getAvatarUrl = () => {
    if (!user?.profile?.logo) return null;
    if (user.profile.logo.startsWith('http')) return user.profile.logo;
    return `https://api-next.livrezone.com${user.profile.logo}`;
  };

  const [unreadMessages, setUnreadMessages] = useState(0);

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

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const q = ((fd.get("q") as string) || "").trim();
    if (!q) return;
    const scope = (fd.get("scope") as string) || "vente";
    const query = encodeURIComponent(q);
    router.push(scope === "livres" ? `/livres?search=${query}` : `/annonces?search=${query}`);
    setSearchOpen(false);
  };

  return (
    <header
      className={`sticky top-0 z-50 bg-white border-b border-gray-100 transition-all duration-200 ${
        scrolled ? "shadow-md py-1" : "py-0"
      }`}
    >
      {/* TOPBAR */}
      <div className="bg-[#1a0a40] text-white py-2 text-[11px] font-bold uppercase tracking-wider transition-all duration-200">
        <div className="w-[90%] max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setLang("FR")} 
              className={`hover:text-violet-300 transition-colors cursor-pointer ${lang === "FR" ? "text-violet-300" : "opacity-60"}`}
            >
              FR
            </button>
            <span className="opacity-30">|</span>
            <button 
              onClick={() => setLang("AR")} 
              className={`hover:text-violet-300 transition-colors cursor-pointer ${lang === "AR" ? "text-violet-300" : "opacity-60"}`}
            >
              AR
            </button>
          </div>
          <div className="hidden sm:block text-violet-200">
            Bienvenue sur LivreZone, votre librairie en ligne !
          </div>
        </div>
      </div>

      {/* MAIN HEADER BAR */}
      <div className="w-[90%] max-w-7xl mx-auto h-[78px] flex items-center justify-between gap-6 relative">
        
        {/* Hamburger Mobile */}
        <button 
          onClick={() => setMenuOpen(!menuOpen)} 
          className="lg:hidden flex-shrink-0 text-black hover:text-[#6D28D9] transition-colors p-1"
          aria-label="Menu"
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>

        {/* LOGO */}
        <Link href="/" className="flex-shrink-0 flex flex-col items-center leading-none group">
          <span className="text-[32px] font-black text-black tracking-tight leading-none group-hover:text-[#6D28D9] transition-colors">L.</span>
          <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-gray-700 mt-[-2px] group-hover:text-[#6D28D9] transition-colors">LivreZone</span>
        </Link>

        {/* RECHERCHE DESKTOP */}
        <form onSubmit={handleSearchSubmit} className="flex-1 hidden lg:flex border-2 border-black hover:border-gray-800 focus-within:border-[#6D28D9] rounded-md transition-colors overflow-hidden h-11">
          <select name="scope" className="bg-gray-50 border-r border-gray-200 px-3 text-[13px] text-black font-semibold focus:outline-none cursor-pointer appearance-none outline-none">
            <option value="vente">Livres en vente</option>
            <option value="livres">Base des livres</option>
          </select>
          <input
            type="search"
            name="q"
            placeholder="Rechercher par ISBN, titre ou auteur"
            className="flex-1 px-4 text-[13px] text-black placeholder-gray-400 focus:outline-none bg-white"
          />
          <button type="submit" className="flex-shrink-0 bg-black hover:bg-[#6D28D9] text-white px-6 transition-colors flex items-center justify-center">
            <Search className="h-4 w-4" strokeWidth={3} />
          </button>
        </form>

        {/* ICONS CONTAINER */}
        <div className="flex items-center gap-5">
          {/* Search Toggle Mobile */}
          <button 
            onClick={() => setSearchOpen(!searchOpen)} 
            className="lg:hidden text-black hover:text-[#6D28D9] transition-colors p-1"
            aria-label="Recherche"
          >
            <Search className="h-6 w-6" />
          </button>

          {/* Wishlist */}
          <Link href="/favorites" className="hidden sm:block relative text-black hover:text-[#6D28D9] transition-colors p-1">
            <Heart className="h-6 w-6" strokeWidth={1.75} />
            {wishlistCount > 0 && (
              <span className="absolute -top-1 -right-1.5 bg-[#6D28D9] text-white text-[10px] font-black rounded-full h-4.5 w-4.5 flex items-center justify-center shadow-sm">
                {wishlistCount}
              </span>
            )}
          </Link>

          {/* Cart */}
          <Link href="/cart" className="relative text-black hover:text-[#6D28D9] transition-colors p-1">
            <ShoppingCart className="h-6 w-6" strokeWidth={1.75} />
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
                  className="flex items-center gap-1 focus:outline-none group"
                >
                  {getAvatarUrl() ? (
                    <img src={getAvatarUrl() as string} alt="Avatar" className="w-10 h-10 rounded-full border-2 border-gray-100 group-hover:border-[#6D28D9] transition-all object-cover shadow-sm" />
                  ) : (
                    <div className="w-10 h-10 rounded-full border-2 border-gray-100 group-hover:border-[#6D28D9] transition-all object-cover shadow-sm bg-[#6D28D9] text-white flex items-center justify-center font-bold text-sm">
                      {(user?.profile?.nickname || user?.name) ? (user?.profile?.nickname || user?.name)?.charAt(0).toUpperCase() : "U"}
                    </div>
                  )}
                  {unreadMessages > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border-2 border-white"></span>
                    </span>
                  )}
                </button>
                
                {userMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-3 w-56 bg-white border border-gray-100 shadow-xl rounded-lg overflow-hidden z-50 text-[13px] text-black">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                      <p className="font-bold text-gray-900">{user?.profile?.nickname || user?.name}</p>
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
                      {unreadMessages > 0 && (
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
                      className="w-full text-left px-4 py-2.5 hover:bg-red-50 hover:text-red-600 text-gray-700 transition-colors flex items-center gap-2"
                    >
                      <LogOut className="h-4 w-4 text-gray-400 group-hover:text-red-600" />
                      Déconnexion
                    </button>
                  </div>
                  </>
                )}
              </div>
            ) : (
              <div className="relative">
                <button 
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="text-black hover:text-[#6D28D9] transition-colors p-1"
                  aria-label="Compte utilisateur"
                >
                  <User className="h-6 w-6" strokeWidth={1.75} />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-3 w-48 bg-white border border-gray-100 shadow-xl rounded-lg overflow-hidden z-50 text-[13px] text-black">
                    <Link 
                      href="/login" 
                      onClick={() => setUserMenuOpen(false)}
                      className="block px-4 py-3 hover:bg-gray-50 hover:text-[#6D28D9] transition-colors border-b border-gray-100 font-medium text-center"
                    >
                      Connexion
                    </Link>
                    <Link 
                      href="/register" 
                      onClick={() => setUserMenuOpen(false)}
                      className="block px-4 py-3 hover:bg-gray-50 hover:text-[#6D28D9] transition-colors text-center text-gray-700"
                    >
                      Créer un compte
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* SEARCH BAR MOBILE (DROPDOWN) */}
        {searchOpen && (
          <div className="absolute top-[78px] left-0 w-full bg-white border-b border-gray-200 p-4 z-40 lg:hidden shadow-lg animate-in slide-in-from-top-4 duration-200">
            <form onSubmit={handleSearchSubmit} className="flex border-2 border-black rounded-md overflow-hidden h-10">
              <select name="scope" className="bg-gray-50 border-r border-gray-200 px-2 text-[11px] text-black font-semibold focus:outline-none cursor-pointer appearance-none outline-none">
                <option value="vente">En vente</option>
                <option value="livres">Base des livres</option>
              </select>
              <input
                type="search"
                name="q"
                placeholder="Rechercher par ISBN, titre ou auteur"
                className="flex-1 px-4 text-[13px] text-black placeholder-gray-400 focus:outline-none bg-white"
              />
              <button type="submit" className="flex-shrink-0 bg-black text-white px-5 flex items-center justify-center">
                <Search className="h-4 w-4" strokeWidth={3} />
              </button>
            </form>
          </div>
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
              <ul className="flex flex-col text-[14px] font-bold text-gray-900 uppercase tracking-wide">
                {navLinks.map((link) => (
                  <li key={link.label}>
                    <Link 
                      href={link.href} 
                      onClick={() => setMenuOpen(false)}
                      className="block px-6 py-3.5 hover:bg-violet-50 hover:text-[#6D28D9] transition-all border-l-4 border-transparent hover:border-[#6D28D9]"
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
      <nav className="hidden lg:block border-t border-gray-100">
        <div className="w-[90%] max-w-7xl mx-auto">
          <ul className="flex items-center justify-center gap-8 h-[46px] text-[12px] font-bold text-gray-900 uppercase tracking-wide">
            {navLinks.map((link) => (
              <li key={link.label}>
                <Link 
                  href={link.href} 
                  className="hover:text-[#6D28D9] transition-colors relative py-2 group"
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
