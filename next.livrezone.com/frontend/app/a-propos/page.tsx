import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "Qui sommes-nous ? | LivreZone",
  description:
    "Découvrez LivreZone, la plateforme marocaine qui met en relation lecteurs, particuliers et librairies.",
};

export default function AboutPage() {
  return (
    <InfoPage
      title="Qui sommes-nous ?"
      description="Plateforme marocaine qui met en relation les lecteurs, les particuliers et les librairies. Elle permet de publier et de découvrir des annonces de livres neufs et d'occasion partout au Maroc, tout en donnant une seconde vie aux ouvrages déjà lus. Cette page est en cours de rédaction."
    />
  );
}