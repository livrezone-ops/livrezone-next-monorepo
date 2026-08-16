import Link from "next/link";

interface InfoPageProps {
  title: string;
  description?: string;
}

export default function InfoPage({ title, description }: InfoPageProps) {
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
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-black mb-3">
          {title}
        </h1>
        <p className="text-sm text-gray-500 leading-relaxed">
          {description ||
            "Cette page est en cours de rédaction. Son contenu sera bientôt disponible."}
        </p>
      </div>
    </div>
  );
}