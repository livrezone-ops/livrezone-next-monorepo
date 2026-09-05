import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import Link from "next/link";
import {
  BookOpen,
  Sparkles,
  GraduationCap,
  Store,
  Users,
  ShieldCheck,
  TrendingUp,
  MapPin,
  Coins,
  RefreshCw,
  HeartHandshake,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Qui sommes-nous ? | LivreZone",
  description:
    "Découvrez LivreZone, la plateforme marocaine qui met en relation lecteurs, particuliers et librairies pour donner une seconde vie aux livres partout au Maroc.",
};

export default function AboutPage() {
  return (
    <InfoPage
      title="Qui sommes-nous ?"
      badge="À propos de LivreZone"
      description="Découvrez l'histoire, la vision et les valeurs qui animent la première plateforme marocaine dédiée au partage et à la vente de livres."
    >
      {/* En-tête / Définition officielle en encart mis en avant */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#1a0a40] to-violet-900 text-white rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="relative z-10 space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-violet-200 uppercase tracking-wider backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Notre Définition
          </span>
          <p className="text-base sm:text-lg font-medium leading-relaxed text-violet-100">
            « <strong className="text-white font-bold">LivreZone</strong> est une plateforme marocaine qui met en relation les lecteurs, les particuliers et les librairies. Elle permet de publier et de découvrir des annonces de livres neufs et d&apos;occasion partout au Maroc, tout en donnant une seconde vie aux ouvrages déjà lus. »
          </p>
        </div>
      </div>

      {/* 1. Pourquoi LivreZone ? */}
      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 text-violet-700 text-sm font-bold">
              1
            </span>
            Pourquoi LivreZone ?
          </h2>
          <p className="text-sm text-gray-600 mt-2">
            L&apos;idée de LivreZone est née d&apos;un constat partagé au quotidien par des milliers d&apos;amoureux de la lecture, d&apos;étudiants et de parents d&apos;élèves à travers le Maroc.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-xl border border-gray-150 bg-gray-50/70 hover:bg-white hover:shadow-xs transition-all space-y-2">
            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <RefreshCw className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">
              Des millions de livres endormis
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              Romans lus une seule fois, manuels scolaires d&apos;une année passée, essais ou collections d&apos;enfants s&apos;accumulent sur les étagères. LivreZone les remet en circulation pour le plaisir d&apos;un nouveau lecteur.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-gray-150 bg-gray-50/70 hover:bg-white hover:shadow-xs transition-all space-y-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">
              Alléger le budget culture & rentrée
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              Le prix des livres neufs importés ou des fournitures scolaires pèse lourdement sur les foyers et les étudiants. L&apos;achat d&apos;occasion permet de diviser la facture tout en conservant une excellente qualité d&apos;ouvrage.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-gray-150 bg-gray-50/70 hover:bg-white hover:shadow-xs transition-all space-y-2">
            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">
              L&apos;accès au livre partout au Maroc
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              En dehors des grandes métropoles, trouver un titre spécifique ou un manuel universitaire précis est souvent un défi. LivreZone abolit les frontières géographiques grâce à une communauté active dans tout le pays.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-gray-150 bg-gray-50/70 hover:bg-white hover:shadow-xs transition-all space-y-2">
            <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
              <Store className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">
              Soutien aux librairies et bouquinistes
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              Les bouquinistes et libraires locaux possèdent des trésors inestimables. Nous leur offrons une vitrine digitale moderne pour valoriser leurs catalogues et toucher une clientèle nationale sans barrière technique.
            </p>
          </div>
        </div>
      </section>

      {/* 2. Notre Mission */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 text-violet-700 text-sm font-bold">
            2
          </span>
          Notre Mission
        </h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-violet-50/50 border border-violet-100">
            <BookOpen className="w-5 h-5 text-violet-700 shrink-0 mt-0.5" />
            <div>
              <strong className="text-sm font-semibold text-gray-900 block mb-1">
                Démocratiser la lecture pour tous
              </strong>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                Rendre le savoir, la littérature et l&apos;apprentissage accessibles à chaque citoyen, quel que soit son budget ou sa localisation, en favorisant l&apos;accès à des livres à prix très doux.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-xl bg-violet-50/50 border border-violet-100">
            <RefreshCw className="w-5 h-5 text-violet-700 shrink-0 mt-0.5" />
            <div>
              <strong className="text-sm font-semibold text-gray-900 block mb-1">
                Favoriser l&apos;économie circulaire et l&apos;éco-responsabilité
              </strong>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                Participer à la préservation de l&apos;environnement en prolongeant la durée de vie des livres déjà imprimés et en luttant contre le gaspillage de papier.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-xl bg-violet-50/50 border border-violet-100">
            <HeartHandshake className="w-5 h-5 text-violet-700 shrink-0 mt-0.5" />
            <div>
              <strong className="text-sm font-semibold text-gray-900 block mb-1">
                Fédérer la communauté des passionnés du livre
              </strong>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                Créer un écosystème bienveillant et solidaire d&apos;entraide littéraire au Maroc, où les lecteurs se recommandent des ouvrages et s&apos;échangent leurs coups de cœur.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. À qui s'adresse LivreZone ? */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 text-violet-700 text-sm font-bold">
            3
          </span>
          À qui s&apos;adresse LivreZone ?
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60 flex items-start gap-3">
            <Users className="w-5 h-5 text-violet-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm text-gray-900">Parents et élèves</h3>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                Pour acheter et revendre facilement manuels scolaires et livres de jeunesse à chaque rentrée.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60 flex items-start gap-3">
            <GraduationCap className="w-5 h-5 text-violet-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm text-gray-900">Étudiants et universitaires</h3>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                Pour trouver cours, polycopiés, manuels de droit, médecine ou ingénierie à tarif étudiant.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-violet-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm text-gray-900">Lecteurs et collectionneurs</h3>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                Pour dénicher des ouvrages rares, romans, histoire, philosophie et littérature arabe ou internationale.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60 flex items-start gap-3">
            <Store className="w-5 h-5 text-violet-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm text-gray-900">Librairies et bouquinistes</h3>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                Pour digitaliser leur inventaire, gagner en visibilité et servir des clients dans tout le Royaume.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Nos Valeurs et Engagements */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 text-violet-700 text-sm font-bold">
            4
          </span>
          Nos Valeurs et Engagements
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60 space-y-1.5 text-center sm:text-left">
            <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center mb-2 mx-auto sm:mx-0">
              <MapPin className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-gray-900">100% Marocain</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Une plateforme pensée pour les réalités locales, nos villes, nos écoles et les modes de remise habituels.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60 space-y-1.5 text-center sm:text-left">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2 mx-auto sm:mx-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-gray-900">Zéro commission</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Aucune commission cachée sur les ventes entre particuliers. Vous conservez 100% du prix de votre livre.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60 space-y-1.5 text-center sm:text-left">
            <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center mb-2 mx-auto sm:mx-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-gray-900">Respect & Éthique</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Une modération attentive respectant les croyances sacrées, les valeurs marocaines et les bonnes mœurs.
            </p>
          </div>
        </div>
      </section>

      {/* Bloc d'action / CTA */}
      <div className="pt-6 border-t border-gray-150 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-gray-900 text-base">
            Prêt à donner une seconde vie à vos livres ?
          </h3>
          <p className="text-xs sm:text-sm text-gray-500">
            Rejoignez dès aujourd&apos;hui la première communauté de lecteurs au Maroc.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Link
            href="/annonces"
            className="flex-1 sm:flex-none text-center px-4 py-2.5 rounded-xl border border-gray-200 text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Explorer le catalogue
          </Link>
          <Link
            href="/annonces/create"
            className="flex-1 sm:flex-none text-center px-4 py-2.5 rounded-xl bg-violet-600 text-xs sm:text-sm font-semibold text-white hover:bg-violet-700 transition-colors shadow-xs"
          >
            Vendre un livre
          </Link>
        </div>
      </div>
    </InfoPage>
  );
}