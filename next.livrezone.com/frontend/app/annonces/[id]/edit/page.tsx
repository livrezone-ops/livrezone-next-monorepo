"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import ListingForm from "@/components/ListingForm";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import api from "@/lib/axios";
import ToastContainer from "@/components/Toast";
import { useToasts } from "@/hooks/useToasts";

export default function EditListingPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const { toasts, pushToast, dismissToast } = useToasts();
  
  const [initialData, setInitialData] = useState<any>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchListing = async () => {
      try {
        const id = Array.isArray(params.id) ? params.id[0] : params.id;
        // We use the authenticated dashboard endpoint to fetch the data
        const res = await api.get(`/dashboard/listings/${id}`);
        const listing = res.data.listing || res.data; // Adaptez selon votre structure d'API
        
        // Check ownership
        if (listing.user_id !== user.id) {
          setError("Vous n'êtes pas autorisé à modifier cette annonce.");
        } else {
          setInitialData(listing);
        }
      } catch (err: any) {
        console.error("Erreur de chargement:", err);
        setError("Impossible de charger l'annonce. Elle a peut-être été supprimée.");
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchListing();
  }, [params.id, user, authLoading, router]);

  if (authLoading || isLoadingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 text-red-700 p-6 rounded-xl shadow-sm text-center max-w-md">
          <p className="font-medium mb-4">{error}</p>
          <button 
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-red-100 hover:bg-red-200 rounded-md transition"
          >
            Retour au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Modifier l'annonce</h1>
          <p className="mt-2 text-sm text-gray-600">Mettez à jour les détails de votre article.</p>
        </div>

        {initialData && (
          <ListingForm 
            initialData={initialData}
            isEditMode={true}
            onSubmitSuccess={() => {
              pushToast("Votre annonce a été mise à jour avec succès");
              setTimeout(() => router.push("/dashboard"), 1200);
            }} 
            onError={(message) => pushToast(message, "warning")}
          />
        )}
      </div>
    </div>
    <ToastContainer toasts={toasts} dismiss={dismissToast} />
    </>
  );
}
