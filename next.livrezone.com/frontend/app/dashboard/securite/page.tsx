"use client";

import PasswordForm from "@/components/PasswordForm";
import PendingAuthRedirect from "@/components/PendingAuthRedirect";

export default function DashboardSecuritePage() {
    return (
        <div className="space-y-6 pb-12">
            <PendingAuthRedirect />
            <header>
                <h1 className="text-2xl lg:text-3xl font-black text-[#1a0a40]">Sécurité</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Gère ton mot de passe et la sécurité de ton compte.
                </p>
            </header>
            <div className="max-w-xl">
                <PasswordForm />
            </div>
        </div>
    );
}
