import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "Conditions Générales de Vente | LivreZone",
  description:
    "Les conditions générales de vente et d'utilisation de la plateforme LivreZone.",
};

export default function CgvPage() {
  return (
    <InfoPage title="Conditions Générales de Vente" />
  );
}