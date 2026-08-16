import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "Contact | LivreZone",
  description:
    "Contactez l'équipe LivreZone pour toute question ou assistance.",
};

export default function ContactPage() {
  return (
    <InfoPage
      title="Contact"
      description="Contactez l'équipe LivreZone pour toute question ou assistance. Cette page est en cours de rédaction."
    />
  );
}