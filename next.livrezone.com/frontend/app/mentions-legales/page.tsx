import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "Mentions légales | LivreZone",
  description:
    "Les mentions légales de la plateforme LivreZone : éditeur, hébergeur et informations juridiques.",
};

export default function MentionsLegalesPage() {
  return (
    <InfoPage title="Mentions légales" />
  );
}