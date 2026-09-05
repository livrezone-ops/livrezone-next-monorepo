"use client";

import React, { useState } from "react";
import Link from "next/link";
import { MessageSquare, Send } from "lucide-react";
import Logo from "@/components/Logo";
import { useToast } from "@/components/Toast";

const FACEBOOK_URL = "https://www.facebook.com/profile.php?id=100089236065066";
const INSTAGRAM_URL = "https://www.instagram.com/livrezone/";

const CATALOG_LINKS: Array<{ href: string; label: string }> = [
  { href: "/annonces?category=LITTERATURE", label: "Romans & Littérature" },
  { href: "/annonces?category=JEUNESSE", label: "Livres pour enfants" },
  { href: "/annonces?category=SCOLAIRE", label: "Scolaire" },
  { href: "/annonces?category=UNIVERSITAIRE", label: "Universitaire & Pro" },
  { href: "/annonces?category=RELIGION", label: "Religion" },
  { href: "/annonces?category=VIE_PRATIQUE", label: "Vie pratique & Loisirs" },
];

const HELP_LINKS: Array<{ href: string; label: string; highlight?: boolean }> = [
  { href: "/faq", label: "FAQ" },
  { href: "/cgv", label: "Conditions Générales" },
  { href: "/a-propos", label: "Qui sommes-nous ?" },
  { href: "/contact", label: "Contact" },
  { href: "/annonces/create", label: "Vendre un livre", highlight: true },
];

export default function Footer() {
  const { success } = useToast();
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      success(`Merci de vous être abonné avec : ${email}`);
      setEmail("");
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, left: 0 });
  };

  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#1a0a40] text-white mt-auto border-t border-violet-950/20">
      <div className="w-[90%] max-w-7xl mx-auto py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr] gap-12">
        {/* Brand Section */}
        <div className="flex flex-col gap-4">
          <div onClick={scrollToTop} className="cursor-pointer self-start">
            <Logo size="md" theme="dark" href="/" />
          </div>
          <p className="text-[13px] text-violet-200/80 leading-relaxed pr-4">
            Plateforme marocaine qui met en relation les lecteurs, les particuliers et les librairies. Elle permet de publier et de découvrir des annonces de livres neufs et d&rsquo;occasion partout au Maroc, tout en donnant une seconde vie aux ouvrages déjà lus.
          </p>
          <div className="flex gap-3 mt-2">
            <a
              href={FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-11 h-11 rounded-full bg-white/10 hover:bg-[#6D28D9] flex items-center justify-center transition-all hover:scale-105"
              aria-label="Facebook"
            >
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z"/></svg>
            </a>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-11 h-11 rounded-full bg-white/10 hover:bg-[#6D28D9] flex items-center justify-center transition-all hover:scale-105"
              aria-label="Instagram"
            >
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            </a>
            <a
              href="https://wa.me/212711214131"
              target="_blank"
              rel="noopener noreferrer"
              className="w-11 h-11 rounded-full bg-white/10 hover:bg-[#6D28D9] flex items-center justify-center transition-all hover:scale-105"
              aria-label="WhatsApp"
            >
              <MessageSquare className="h-5 w-5" />
            </a>
          </div>
        </div>

        {/* Catalog Section */}
        <div>
          <h3 className="text-[12px] font-bold uppercase tracking-widest text-violet-300 mb-5 pb-1 border-b border-white/5 inline-block">
            Catalogue
          </h3>
          <ul className="space-y-3 text-[13px] text-violet-100/90 font-medium">
            {CATALOG_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={scrollToTop}
                  className="hover:text-white hover:underline transition-all"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Aide & Contact Section */}
        <div>
          <h3 className="text-[12px] font-bold uppercase tracking-widest text-violet-300 mb-5 pb-1 border-b border-white/5 inline-block">
            Aide & Contact
          </h3>
          <ul className="space-y-3 text-[13px] text-violet-100/90 font-medium">
            {HELP_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={scrollToTop}
                  className={
                    link.highlight
                      ? "hover:text-white hover:underline transition-all bg-gradient-to-r from-orange-400 to-orange-500 text-transparent bg-clip-text font-bold"
                      : "hover:text-white hover:underline transition-all"
                  }
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Newsletter Section */}
        <div className="flex flex-col gap-4">
          <h3 className="text-[12px] font-bold uppercase tracking-widest text-violet-300 mb-1 pb-1 border-b border-white/5 inline-block self-start">
            Newsletter
          </h3>
          <p className="text-[13px] text-violet-200/80 leading-relaxed">
            Abonnez-vous pour recevoir en avant-première nos meilleures offres et actualités.
          </p>
          <form onSubmit={handleSubmit} className="flex rounded-md overflow-hidden border border-white/10 focus-within:border-[#6D28D9] transition-all">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              className="flex-1 px-3 py-2.5 text-[13px] bg-white/10 text-white placeholder-violet-300/60 focus:outline-none w-full"
              required
            />
            <button
              type="submit"
              className="bg-black hover:bg-[#6D28D9] text-white px-4 transition-colors flex items-center justify-center"
              aria-label="S'abonner"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Bottom copyrights */}
      <div className="border-t border-white/10 py-6 text-center text-[12px] text-violet-300/80 bg-black/10">
        <div className="w-[90%] max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <span>&copy; {currentYear} LivreZone. Tous droits réservés.</span>
          <div className="flex gap-4">
            <Link
              href="/confidentialite"
              onClick={scrollToTop}
              className="hover:text-white transition-colors"
            >
              Politique de confidentialité
            </Link>
            <span>&bull;</span>
            <Link
              href="/mentions-legales"
              onClick={scrollToTop}
              className="hover:text-white transition-colors"
            >
              Mentions légales
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}