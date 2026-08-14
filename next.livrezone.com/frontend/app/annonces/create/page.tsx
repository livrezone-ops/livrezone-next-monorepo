"use client";

import { useRouter } from "next/navigation";
import ListingForm from "@/components/ListingForm";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export default function CreateListingPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  // Rediriger vers la connexion si non authentifié
  if (!isLoading && !user) {
    router.push("/login");
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Publier une annonce</h1>
          <p className="mt-2 text-sm text-gray-600">Remplissez les détails de votre livre pour le proposer à la vente.</p>
        </div>

        <ListingForm 
          onSubmitSuccess={() => {
            alert("Votre annonce a été publiée avec succès !");
            router.push("/dashboard");
          }} 
        />
      </div>
    </div>
  );
}
