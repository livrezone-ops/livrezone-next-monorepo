import type { Metadata } from "next";
import ReferralSpace from "@/components/ReferralSpace";

export const metadata: Metadata = {
    title: "Parrainage",
    description:
        "Invitez vos amis sur LivreZone et gagnez des récompenses : jours de compte Pro, réductions et livres offerts à chaque inscription validée.",
    robots: { index: false, follow: false },
};

export default function ReferralPage() {
    return (
        <div className="min-h-[70vh] bg-gray-50">
            <ReferralSpace />
        </div>
    );
}
