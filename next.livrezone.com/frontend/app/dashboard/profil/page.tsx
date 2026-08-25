"use client";

import ProfileForm from "@/components/ProfileForm";
import PendingAuthRedirect from "@/components/PendingAuthRedirect";

export default function DashboardProfilPage() {
    return (
        <div className="space-y-6 pb-12">
            <PendingAuthRedirect />
            <header>
                <h1 className="text-2xl lg:text-3xl font-black text-[#1a0a40]">Mon profil</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Modifie tes informations personnelles et ton identité de vendeur.
                </p>
            </header>
            <ProfileForm
                title="Informations du profil"
                subtitle="Ces informations sont visibles sur ta librairie publique."
            />
        </div>
    );
}
