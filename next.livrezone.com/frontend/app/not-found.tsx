import Link from "next/link";
import { BookOpen, Search, Home, HelpCircle } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page introuvable (404) | LivreZone",
  description: "La page que vous recherchez semble introuvable ou a été déplacée.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function NotFound() {
  return (
    <div className="flex-1 flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-purple-50/50 to-white">
      <div className="max-w-xl w-full text-center space-y-8">
        {/* Illustration / Badge */}
        <div className="relative inline-block">
          <div className="w-24 h-24 sm:w-28 sm:h-28 mx-auto bg-purple-100 text-purple-700 rounded-3xl flex items-center justify-center shadow-inner">
            <BookOpen className="w-12 h-12 sm:w-14 sm:h-14" />
          </div>
          <span className="absolute -bottom-2 -right-2 bg-purple-700 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">
            404
          </span>
        </div>

        {/* Titre & Message */}
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
            Page ou livre introuvable
          </h1>
          <p className="text-base sm:text-lg text-gray-600 max-w-md mx-auto">
            Désolé, l&apos;annonce ou la page que vous recherchez n&apos;existe pas, a été vendue ou a changé d&apos;adresse.
          </p>
        </div>

        {/* Barre de recherche rapide */}
        <form
          action="/annonces"
          method="GET"
          className="max-w-md mx-auto flex items-center bg-white border border-gray-200 rounded-xl p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-purple-600 focus-within:border-transparent transition-all"
        >
          <Search className="w-5 h-5 text-gray-400 ml-3 shrink-0" />
          <input
            type="text"
            name="search"
            placeholder="Rechercher un livre, un auteur, un ISBN..."
            className="w-full px-3 py-2 text-sm text-gray-900 bg-transparent focus:outline-none placeholder-gray-400"
          />
          <button
            type="submit"
            className="bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shrink-0"
          >
            Rechercher
          </button>
        </form>

        {/* Actions principales */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-medium text-sm rounded-xl shadow-sm hover:shadow transition-all"
          >
            <Home className="w-4 h-4" />
            Accueil
          </Link>
          <Link
            href="/annonces"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-medium text-sm rounded-xl border border-gray-200 shadow-sm transition-all"
          >
            <BookOpen className="w-4 h-4 text-purple-600" />
            Explorer les annonces
          </Link>
          <Link
            href="/faq"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-medium text-sm rounded-xl border border-gray-200 shadow-sm transition-all"
          >
            <HelpCircle className="w-4 h-4 text-gray-500" />
            Centre d&apos;aide
          </Link>
        </div>

        {/* Raccourcis catégories */}
        <div className="border-t border-gray-100 pt-6">
          <p className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-3">
            Catégories populaires
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-xs">
            <Link
              href="/annonces?category=SCOLAIRE"
              className="px-3 py-1.5 bg-gray-100 hover:bg-purple-100 hover:text-purple-700 rounded-lg text-gray-600 transition-colors"
            >
              Rentrée Scolaire
            </Link>
            <Link
              href="/annonces?category=ROMANS"
              className="px-3 py-1.5 bg-gray-100 hover:bg-purple-100 hover:text-purple-700 rounded-lg text-gray-600 transition-colors"
            >
              Romans & Littérature
            </Link>
            <Link
              href="/annonces?category=JEUNESSE"
              className="px-3 py-1.5 bg-gray-100 hover:bg-purple-100 hover:text-purple-700 rounded-lg text-gray-600 transition-colors"
            >
              Jeunesse & BD
            </Link>
            <Link
              href="/annonces?category=UNIVERSITAIRE"
              className="px-3 py-1.5 bg-gray-100 hover:bg-purple-100 hover:text-purple-700 rounded-lg text-gray-600 transition-colors"
            >
              Universitaire & Prépa
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
