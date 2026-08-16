import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "FAQ | LivreZone",
  description:
    "Les questions fréquemment posées sur LivreZone : comment publier, acheter, négocier et recevoir vos livres.",
};

export default function FaqPage() {
  return <InfoPage title="FAQ" />;
}