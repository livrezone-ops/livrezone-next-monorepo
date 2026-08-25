import Link from "next/link";

export default function AdminForbidden() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-white px-4 rounded-2xl border border-gray-100">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center">
          <span className="text-rose-500 text-2xl font-black">403</span>
        </div>
        <h1 className="text-2xl font-black text-gray-950 mb-1">Accès non autorisé</h1>
        <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
          Cette section est réservée aux administrateurs. Si vous pensez qu&rsquo;il
          s&rsquo;agit d&rsquo;une erreur, contactez l&rsquo;équipe LivreZone.
        </p>
        <Link
          href="/"
          className="inline-flex mt-6 px-5 py-2.5 bg-[#6D28D9] text-white font-bold text-xs rounded-xl hover:bg-violet-800 transition-all"
        >
          Retour à l&rsquo;accueil
        </Link>
      </div>
    </div>
  );
}
