import React from "react";
import Link from "next/link";

interface InfoPageProps {
  title: string;
  description?: string;
  badge?: string;
  children?: React.ReactNode;
}

export default function InfoPage({
  title,
  description,
  badge,
  children,
}: InfoPageProps) {
  return (
    <div className="w-[90%] max-w-4xl mx-auto py-8">
      <nav
        aria-label="Fil d'Ariane"
        className="mb-8 text-xs md:text-sm font-semibold text-gray-500 flex items-center gap-2 flex-wrap tracking-wide uppercase"
      >
        <Link href="/" className="hover:text-black transition-colors">
          Accueil
        </Link>
        <span>/</span>
        <span className="text-black font-semibold">{title}</span>
      </nav>
      <div className="bg-white border border-gray-100 rounded-2xl p-8 sm:p-12 shadow-xs">
        {badge && (
          <span className="inline-block px-3 py-1 mb-3 text-xs font-semibold tracking-wider text-violet-700 bg-violet-50 rounded-full uppercase">
            {badge}
          </span>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-black mb-3">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-gray-500 leading-relaxed mb-8">
            {description}
          </p>
        )}
        {children ? (
          <div className="text-gray-700 leading-relaxed space-y-8">
            {children}
          </div>
        ) : !description ? (
          <p className="text-sm text-gray-500 leading-relaxed">
            Cette page est en cours de rédaction. Son contenu sera bientôt disponible.
          </p>
        ) : null}
      </div>
    </div>
  );
}