import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import Link from "next/link";
import {
  Compass,
  ShoppingBag,
  BookOpen,
  Store,
  ShieldCheck,
  ChevronDown,
  MessageCircle,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Foire Aux Questions (FAQ) | LivreZone",
  description:
    "Toutes les réponses à vos questions sur LivreZone : achat, vente, livraison, sécurisation des transactions et comptes librairies au Maroc.",
};

export default function FaqPage() {
  return (
    <InfoPage
      title="Foire Aux Questions (FAQ)"
      badge="Centre d'aide"
      description="Trouvez rapidement des réponses claires sur le fonctionnement de LivreZone, l'achat, la vente et la sécurité de vos échanges."
    >
      {/* Thématique 1 : Généralités & Fonctionnement */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 text-violet-700">
            <Compass className="w-4 h-4" />
          </span>
          Généralités & Fonctionnement
        </h2>
        <div className="space-y-3">
          <details className="group border border-gray-200 rounded-xl bg-gray-50/50 p-4 transition-all open:bg-white open:shadow-xs open:border-violet-300">
            <summary className="flex items-center justify-between cursor-pointer font-semibold text-gray-900 list-none select-none">
              <span className="text-sm sm:text-base pr-4">Qu’est-ce que LivreZone ?</span>
              <ChevronDown className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform duration-200 shrink-0" />
            </summary>
            <div className="pt-3 text-sm text-gray-600 leading-relaxed border-t border-gray-100 mt-3">
              LivreZone est la première plateforme marocaine dédiée à la mise en relation entre passionnés de lecture, étudiants, particuliers et librairies professionnelles. Elle permet de donner une seconde vie aux livres déjà lus, de dénicher des ouvrages rares ou scolaires à prix accessible et de soutenir les librairies indépendantes à travers tout le Royaume.
            </div>
          </details>

          <details className="group border border-gray-200 rounded-xl bg-gray-50/50 p-4 transition-all open:bg-white open:shadow-xs open:border-violet-300">
            <summary className="flex items-center justify-between cursor-pointer font-semibold text-gray-900 list-none select-none">
              <span className="text-sm sm:text-base pr-4">L&apos;inscription et l&apos;utilisation sont-elles gratuites ?</span>
              <ChevronDown className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform duration-200 shrink-0" />
            </summary>
            <div className="pt-3 text-sm text-gray-600 leading-relaxed border-t border-gray-100 mt-3">
              Oui ! L&apos;inscription et la consultation des annonces sont totalement gratuites. Les particuliers peuvent également publier gratuitement leurs annonces dans la limite du quota alloué à leur profil.
            </div>
          </details>

          <details className="group border border-gray-200 rounded-xl bg-gray-50/50 p-4 transition-all open:bg-white open:shadow-xs open:border-violet-300">
            <summary className="flex items-center justify-between cursor-pointer font-semibold text-gray-900 list-none select-none">
              <span className="text-sm sm:text-base pr-4">Dans quelles villes du Maroc le service est-il disponible ?</span>
              <ChevronDown className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform duration-200 shrink-0" />
            </summary>
            <div className="pt-3 text-sm text-gray-600 leading-relaxed border-t border-gray-100 mt-3">
              LivreZone est disponible partout au Maroc (Casablanca, Rabat, Fès, Marrakech, Tanger, Agadir, Meknès, Oujda, Tétouan, etc.). Vous pouvez filtrer les annonces par ville pour privilégier la proximité ou organiser une livraison par transporteur.
            </div>
          </details>
        </div>
      </section>

      {/* Thématique 2 : Acheter un livre */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 text-violet-700">
            <ShoppingBag className="w-4 h-4" />
          </span>
          Acheter un livre
        </h2>
        <div className="space-y-3">
          <details className="group border border-gray-200 rounded-xl bg-gray-50/50 p-4 transition-all open:bg-white open:shadow-xs open:border-violet-300">
            <summary className="flex items-center justify-between cursor-pointer font-semibold text-gray-900 list-none select-none">
              <span className="text-sm sm:text-base pr-4">Comment acheter un livre sur LivreZone ?</span>
              <ChevronDown className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform duration-200 shrink-0" />
            </summary>
            <div className="pt-3 text-sm text-gray-600 leading-relaxed border-t border-gray-100 mt-3 space-y-2">
              <p>Dès qu&apos;un livre vous intéresse :</p>
              <ol className="list-decimal list-inside space-y-1 pl-1 text-gray-700">
                <li>Consultez les détails de l&apos;annonce (état de l&apos;ouvrage, photos réelles, ville et prix).</li>
                <li>Contactez directement le vendeur via la messagerie interne du site ou par WhatsApp/téléphone (si renseigné par le vendeur).</li>
                <li>Convenez ensemble des modalités de remise et du moyen de paiement.</li>
              </ol>
            </div>
          </details>

          <details className="group border border-gray-200 rounded-xl bg-gray-50/50 p-4 transition-all open:bg-white open:shadow-xs open:border-violet-300">
            <summary className="flex items-center justify-between cursor-pointer font-semibold text-gray-900 list-none select-none">
              <span className="text-sm sm:text-base pr-4">Comment s&apos;effectue le paiement ?</span>
              <ChevronDown className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform duration-200 shrink-0" />
            </summary>
            <div className="pt-3 text-sm text-gray-600 leading-relaxed border-t border-gray-100 mt-3">
              Le paiement se fait <strong>directement entre l&apos;acheteur et le vendeur</strong>. LivreZone ne prélève aucune commission sur les ventes et n&apos;encaisse aucun paiement d&apos;intermédiation. Le règlement s&apos;effectue le plus souvent en espèces lors de la remise en main propre, ou par virement bancaire / versement lors d&apos;une expédition.
            </div>
          </details>

          <details className="group border border-gray-200 rounded-xl bg-gray-50/50 p-4 transition-all open:bg-white open:shadow-xs open:border-violet-300">
            <summary className="flex items-center justify-between cursor-pointer font-semibold text-gray-900 list-none select-none">
              <span className="text-sm sm:text-base pr-4">Comment se passe la livraison ?</span>
              <ChevronDown className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform duration-200 shrink-0" />
            </summary>
            <div className="pt-3 text-sm text-gray-600 leading-relaxed border-t border-gray-100 mt-3 space-y-2">
              <p>Deux options principales existent :</p>
              <ul className="list-disc list-inside space-y-1 pl-1 text-gray-700">
                <li><strong>Remise en main propre :</strong> Rencontre directe convenue dans un lieu public sécurisé de votre ville.</li>
                <li><strong>Expédition nationale :</strong> Les parties s&apos;accordent sur le transporteur de leur choix (Amana, CTM Messagerie, livreurs express locaux, etc.). Les frais de livraison sont généralement pris en charge par l&apos;acheteur.</li>
              </ul>
            </div>
          </details>

          <details className="group border border-gray-200 rounded-xl bg-gray-50/50 p-4 transition-all open:bg-white open:shadow-xs open:border-violet-300">
            <summary className="flex items-center justify-between cursor-pointer font-semibold text-gray-900 list-none select-none">
              <span className="text-sm sm:text-base pr-4">Que faire si je ne trouve pas le livre que je recherche ?</span>
              <ChevronDown className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform duration-200 shrink-0" />
            </summary>
            <div className="pt-3 text-sm text-gray-600 leading-relaxed border-t border-gray-100 mt-3">
              Vous pouvez publier gratuitement une requête dans la section{" "}
              <Link href="/demandes" className="text-violet-700 font-semibold underline hover:text-violet-900">
                Demandes de livres
              </Link>.
              Les membres de la communauté et les librairies abonnées qui disposent de l&apos;ouvrage pourront vous contacter directement pour vous le proposer.
            </div>
          </details>
        </div>
      </section>

      {/* Thématique 3 : Vendre un livre */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 text-violet-700">
            <BookOpen className="w-4 h-4" />
          </span>
          Vendre un livre
        </h2>
        <div className="space-y-3">
          <details className="group border border-gray-200 rounded-xl bg-gray-50/50 p-4 transition-all open:bg-white open:shadow-xs open:border-violet-300">
            <summary className="flex items-center justify-between cursor-pointer font-semibold text-gray-900 list-none select-none">
              <span className="text-sm sm:text-base pr-4">Comment déposer une annonce ?</span>
              <ChevronDown className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform duration-200 shrink-0" />
            </summary>
            <div className="pt-3 text-sm text-gray-600 leading-relaxed border-t border-gray-100 mt-3">
              Cliquez sur le bouton{" "}
              <Link href="/annonces/create" className="text-violet-700 font-semibold underline hover:text-violet-900">
                Vendre un livre
              </Link>
              , renseignez le titre de l&apos;ouvrage, l&apos;auteur, la catégorie, son état réel (comme neuf, bon état, etc.), votre prix et votre ville, puis téléversez une photo nette de la couverture. Votre annonce sera immédiatement accessible au public.
            </div>
          </details>

          <details className="group border border-gray-200 rounded-xl bg-gray-50/50 p-4 transition-all open:bg-white open:shadow-xs open:border-violet-300">
            <summary className="flex items-center justify-between cursor-pointer font-semibold text-gray-900 list-none select-none">
              <span className="text-sm sm:text-base pr-4">Quels sont les ouvrages strictement interdits ?</span>
              <ChevronDown className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform duration-200 shrink-0" />
            </summary>
            <div className="pt-3 text-sm text-gray-600 leading-relaxed border-t border-gray-100 mt-3 space-y-2">
              <p>Conformément à notre charte et à la loi marocaine, sont rigoureusement prohibés :</p>
              <ul className="list-disc list-inside space-y-1 pl-1 text-gray-700">
                <li>Tout contenu portant atteinte à l&apos;Islam et aux croyances religieuses.</li>
                <li>Tout ouvrage séditieux portant atteinte à la Monarchie, aux symboles du Royaume ou à l&apos;intégrité territoriale.</li>
                <li>Toute couverture ou contenu non pudique, licencieux, pornographique ou contraire aux bonnes mœurs.</li>
                <li>Les contrefaçons, photocopies illégales et infractions aux droits d&apos;auteur.</li>
              </ul>
              <p className="text-xs text-red-600 pt-1 font-medium">
                Toute annonce non conforme est immédiatement retirée par l&apos;administration et son auteur s&apos;expose à un bannissement.
              </p>
            </div>
          </details>

          <details className="group border border-gray-200 rounded-xl bg-gray-50/50 p-4 transition-all open:bg-white open:shadow-xs open:border-violet-300">
            <summary className="flex items-center justify-between cursor-pointer font-semibold text-gray-900 list-none select-none">
              <span className="text-sm sm:text-base pr-4">Combien d&apos;annonces puis-je déposer ?</span>
              <ChevronDown className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform duration-200 shrink-0" />
            </summary>
            <div className="pt-3 text-sm text-gray-600 leading-relaxed border-t border-gray-100 mt-3">
              Chaque profil particulier bénéficie d&apos;un quota d&apos;annonces gratuites actives simultanément. Si vous avez un volume de livres plus important à vendre ou souhaitez des options de mise en avant, vous pouvez consulter nos formules dans l&apos;espace abonnement.
            </div>
          </details>
        </div>
      </section>

      {/* Thématique 4 : Profils & Librairies */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 text-violet-700">
            <Store className="w-4 h-4" />
          </span>
          Profils & Librairies Professionnelles
        </h2>
        <div className="space-y-3">
          <details className="group border border-gray-200 rounded-xl bg-gray-50/50 p-4 transition-all open:bg-white open:shadow-xs open:border-violet-300">
            <summary className="flex items-center justify-between cursor-pointer font-semibold text-gray-900 list-none select-none">
              <span className="text-sm sm:text-base pr-4">Quelle est la différence entre un compte Particulier et un compte Librairie ?</span>
              <ChevronDown className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform duration-200 shrink-0" />
            </summary>
            <div className="pt-3 text-sm text-gray-600 leading-relaxed border-t border-gray-100 mt-3 space-y-2">
              <ul className="list-disc list-inside space-y-1.5 pl-1 text-gray-700">
                <li>
                  <strong>Compte Particulier :</strong> Pour les lecteurs souhaitant vendre, échanger ou acheter occasionnellement des ouvrages personnels.
                </li>
                <li>
                  <strong>Compte Librairie :</strong> Réservé aux professionnels (librairies de quartier, bouquinistes, distributeurs). Il offre une page vitrine personnalisée, un quota d&apos;annonces élevé et des fonctionnalités professionnelles adaptées à la vente en volume.
                </li>
              </ul>
            </div>
          </details>
        </div>
      </section>

      {/* Thématique 5 : Sécurité & Bonnes pratiques */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 text-violet-700">
            <ShieldCheck className="w-4 h-4" />
          </span>
          Sécurité & Bonnes pratiques
        </h2>
        <div className="space-y-3">
          <details className="group border border-gray-200 rounded-xl bg-gray-50/50 p-4 transition-all open:bg-white open:shadow-xs open:border-violet-300">
            <summary className="flex items-center justify-between cursor-pointer font-semibold text-gray-900 list-none select-none">
              <span className="text-sm sm:text-base pr-4">Quels sont les réflexes essentiels de sécurité ?</span>
              <ChevronDown className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform duration-200 shrink-0" />
            </summary>
            <div className="pt-3 text-sm text-gray-600 leading-relaxed border-t border-gray-100 mt-3 space-y-2">
              <ul className="list-disc list-inside space-y-1 pl-1 text-gray-700">
                <li>Privilégiez la remise en main propre dans un lieu public et fréquenté (café, gare, place, centre commercial).</li>
                <li>Vérifiez attentivement l&apos;état des pages, de la reliure et de l&apos;édition avant de remettre votre règlement.</li>
                <li>N&apos;effectuez jamais de virement anticipé à un inconnu sans garantie préalable avérée.</li>
              </ul>
            </div>
          </details>

          <details className="group border border-gray-200 rounded-xl bg-gray-50/50 p-4 transition-all open:bg-white open:shadow-xs open:border-violet-300">
            <summary className="flex items-center justify-between cursor-pointer font-semibold text-gray-900 list-none select-none">
              <span className="text-sm sm:text-base pr-4">Comment signaler une annonce suspecte ou non conforme ?</span>
              <ChevronDown className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform duration-200 shrink-0" />
            </summary>
            <div className="pt-3 text-sm text-gray-600 leading-relaxed border-t border-gray-100 mt-3">
              Si une annonce enfreint notre charte ou vous paraît suspecte, signalez-la via le bouton de signalement présent sur l&apos;annonce ou transmettez-nous le lien directement via notre{" "}
              <Link href="/contact" className="text-violet-700 font-semibold underline hover:text-violet-900">
                formulaire de contact
              </Link>.
              L&apos;équipe de modération intervient dans les plus brefs délais.
            </div>
          </details>
        </div>
      </section>

      {/* Bloc assistance */}
      <div className="bg-violet-50/60 border border-violet-100 rounded-2xl p-6 text-center space-y-3 mt-8">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-violet-600 text-white">
          <MessageCircle className="w-5 h-5" />
        </div>
        <h3 className="font-bold text-gray-900 text-base">Vous avez encore une question ?</h3>
        <p className="text-xs sm:text-sm text-gray-600 max-w-md mx-auto">
          Notre équipe est à votre disposition pour vous accompagner dans vos achats, vos ventes ou pour toute assistance technique.
        </p>
        <div className="pt-2">
          <Link
            href="/contact"
            className="inline-block px-5 py-2.5 bg-violet-600 text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors shadow-xs"
          >
            Nous contacter
          </Link>
        </div>
      </div>
    </InfoPage>
  );
}