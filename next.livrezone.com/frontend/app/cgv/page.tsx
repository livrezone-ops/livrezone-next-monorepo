import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import { ShieldAlert, AlertTriangle, Scale, Lock, BookX, Ban } from "lucide-react";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation et de Vente | LivreZone",
  description:
    "Conditions Générales d'Utilisation et de Vente de la plateforme LivreZone (livrezone.com). Rôle, responsabilités, charte éthique et cadre légal.",
};

export default function CgvPage() {
  return (
    <InfoPage
      title="Conditions Générales d'Utilisation et de Vente"
      badge="Dernière mise à jour : Mars 2026"
      description="Les présentes conditions régissent l'accès et l'utilisation de la plateforme livrezone.com. Veuillez les lire attentivement avant toute publication ou transaction."
    >
      {/* 1. Préambule et rôle */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 text-violet-700 text-sm font-bold">
            1
          </span>
          Préambule et rôle de la plateforme
        </h2>
        <p className="text-sm leading-relaxed text-gray-600">
          Le site web <strong className="text-gray-900 font-semibold">LivreZone</strong> (accessible à l&apos;adresse{" "}
          <strong className="text-gray-900 font-semibold">livrezone.com</strong>) est une plateforme numérique d&apos;intermédiation technique permettant de mettre en relation des utilisateurs (particuliers, passionnés de lecture et librairies professionnelles) pour l&apos;achat, la vente ou l&apos;échange d&apos;ouvrages neufs et d&apos;occasion au Maroc.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 space-y-2">
          <p className="font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            LivreZone agit exclusivement en qualité d&apos;hébergeur technique et de tiers facilitateur.
          </p>
          <ul className="list-disc list-inside space-y-1 text-amber-800 text-xs sm:text-sm pl-1">
            <li>LivreZone n&apos;est ni propriétaire, ni vendeur, ni acheteur des ouvrages proposés dans les annonces.</li>
            <li>LivreZone n&apos;est pas partie prenante aux contrats de vente ou d&apos;échange conclus directement entre utilisateurs.</li>
            <li>LivreZone ne garantit en aucun cas la solvabilité des acheteurs, la bonne foi des vendeurs, la conformité des ouvrages ou l&apos;effectivité des livraisons.</li>
          </ul>
        </div>
      </section>

      {/* 2. Exonération totale de responsabilité */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 text-violet-700 text-sm font-bold">
            2
          </span>
          Exonération totale de responsabilité et renonciation aux recours
        </h2>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-900 space-y-3">
          <div className="flex items-start gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="font-bold text-red-950">
                Absence de responsabilité transactionnelle et éditoriale :
              </p>
              <p className="text-xs sm:text-sm text-red-900/90 leading-relaxed">
                LivreZone décline toute responsabilité concernant les litiges, différends commerciaux, pertes financières, retards d&apos;expédition, colis endommagés, vices cachés, non-conformité de l&apos;état d&apos;un livre ou défauts de paiement entre acheteur et vendeur. Chaque utilisateur est seul et entièrement responsable civil et pénal du contenu qu&apos;il publie et des transactions qu&apos;il conclut.
              </p>
            </div>
          </div>
          <div className="border-t border-red-200/80 pt-3 text-xs sm:text-sm text-red-950 font-medium">
            <strong className="font-bold">Clause de renonciation expresse aux poursuites judiciaires :</strong> En accédant au site et en l&apos;utilisant, chaque utilisateur renonce irrévocablement et expressément à engager toute action en justice, poursuite, plainte, recours indemnitaire ou réclamation à l&apos;encontre de LivreZone, de son éditeur, de ses administrateurs, fondateurs ou partenaires, au titre d&apos;une annonce, d&apos;une relation inter-utilisateurs ou d&apos;une transaction réalisée via la plateforme.
          </div>
        </div>
      </section>

      {/* 3. Contenus et ouvrages strictement interdits */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 text-violet-700 text-sm font-bold">
            3
          </span>
          Charte éthique et contenus strictement interdits
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          Toute annonce doit impérativement respecter les lois en vigueur dans le Royaume du Maroc, ainsi que les valeurs morales et religieuses de notre société. Sont <strong className="text-red-600 font-bold">strictement et formellement interdits</strong> sur LivreZone :
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/70 space-y-2">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <BookX className="w-4 h-4 text-red-500" />
              Atteinte aux croyances sacrées
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Tout ouvrage, couverture, titre ou commentaire portant atteinte à l&apos;Islam, aux religions, aux préceptes sacrés ou aux convictions religieuses.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/70 space-y-2">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <Scale className="w-4 h-4 text-red-500" />
              Atteinte au Royaume et aux institutions
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Tout ouvrage séditieux portant atteinte à la Monarchie, aux symboles de l&apos;État marocain, à l&apos;intégrité territoriale du Royaume ou à l&apos;ordre public national.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/70 space-y-2">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <Ban className="w-4 h-4 text-red-500" />
              Couvertures et contenus non pudiques
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Tout livre, couverture, illustration ou image à caractère obscène, pornographique, érotique non pudique ou contraire aux bonnes mœurs et à la décence.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/70 space-y-2">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <Lock className="w-4 h-4 text-red-500" />
              Contrefaçons et piratage
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              La vente de reproductions illicites, photocopies non autorisées, contrefaçons d&apos;éditeurs ou violation des droits d&apos;auteur et de la propriété intellectuelle.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Droits de modération de l'Administration */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 text-violet-700 text-sm font-bold">
            4
          </span>
          Prérogatives et droits de modération de l&apos;administration
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          L&apos;administration de LivreZone dispose d&apos;un droit de regard et de contrôle absolu sur tous les contenus hébergés :
        </p>
        <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 pl-2">
          <li>
            <strong className="font-semibold text-gray-900">Retrait immédiat et sans préavis :</strong> L&apos;administrateur a le droit souverain de masquer, modifier ou supprimer immédiatement et sans indemnité toute annonce, image ou texte ne respectant pas les règles du site ou signalée par la communauté.
          </li>
          <li>
            <strong className="font-semibold text-gray-900">Bannissement de comptes :</strong> Suspension immédiate, temporaire ou définitive, de tout compte utilisateur en cas de violation constatée, de comportement inapproprié ou de tentative de fraude.
          </li>
          <li>
            <strong className="font-semibold text-gray-900">Signalement légal :</strong> En cas de violation grave de la loi marocaine, LivreZone se réserve le droit de transmettre les données utiles aux autorités administratives ou judiciaires compétentes.
          </li>
        </ul>
      </section>

      {/* 5. Sécurité, commentaires et contournement des limites */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 text-violet-700 text-sm font-bold">
            5
          </span>
          Sécurité, comportement et respect des quotas de profil
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          Afin de garantir un environnement sain et sécurisé, chaque utilisateur s&apos;engage à respecter les règles suivantes :
        </p>
        <div className="space-y-3 text-sm text-gray-700">
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <strong className="font-semibold text-gray-900 block mb-1">
              • Respect des quotas et des limites données par profil :
            </strong>
            Il est formellement interdit de tenter de contourner techniquement ou administrativement les limites attribuées à votre type de compte (nombre d&apos;annonces actives autorisées, plafonds de contact, etc.), notamment via la création artificielle de multi-comptes ou l&apos;usage de faux profils.
          </div>
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <strong className="font-semibold text-gray-900 block mb-1">
              • Interdiction formelle de piratage et d&apos;attaques :
            </strong>
            Toute tentative d&apos;intrusion informatique, d&apos;altération de code, d&apos;extraction automatisée de données (scraping non consenti), d&apos;exploitation de failles ou d&apos;attaque des serveurs et de l&apos;API de LivreZone fera l&apos;objet de poursuites pénales immédiates.
          </div>
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <strong className="font-semibold text-gray-900 block mb-1">
              • Courtoisie dans les commentaires et avis :
            </strong>
            Les espaces d&apos;évaluation, messages et commentaires doivent rester strictement courtois et bienveillants. Tout propos injurieux, diffamatoire, menaçant ou à visée de harcèlement sera supprimé et sanctionné.
          </div>
        </div>
      </section>

      {/* 6. Protection des données personnelles */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 text-violet-700 text-sm font-bold">
            6
          </span>
          Données personnelles (Loi marocaine n° 09-08)
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          Le traitement des données personnelles collectées sur LivreZone est effectué en conformité avec la <strong className="text-gray-900 font-semibold">loi n° 09-08</strong> relative à la protection des personnes physiques à l&apos;égard du traitement des données à caractère personnel. Les informations d&apos;inscription et de contact sont strictement nécessaires à l&apos;accès à la plateforme et à la mise en relation. Vous disposez d&apos;un droit d&apos;accès, de rectification et d&apos;opposition auprès de nos équipes.
        </p>
      </section>

      {/* 7. Droit applicable */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 text-violet-700 text-sm font-bold">
            7
          </span>
          Droit applicable et juridiction compétente
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          Les présentes Conditions Générales sont exclusivement régies par le <strong className="text-gray-900 font-semibold">droit marocain</strong>. En cas de contestation ou de litige relatif à la validité, l&apos;interprétation ou l&apos;exécution des présentes, compétence expresse et exclusive est attribuée aux tribunaux compétents du Royaume du Maroc.
        </p>
      </section>
    </InfoPage>
  );
}