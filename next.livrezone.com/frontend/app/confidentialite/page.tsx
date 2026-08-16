import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "Politique de confidentialité | LivreZone",
  description:
    "La politique de confidentialité de LivreZone : comment nous collectons, utilisons et protégeons vos données.",
};

export default function ConfidentialitePage() {
  return (
    <InfoPage title="Politique de confidentialité" />
  );
}