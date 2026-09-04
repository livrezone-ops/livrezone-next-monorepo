"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ListingForm, { type ListingFormProps } from "@/components/ListingForm";
import api from "@/lib/axios";
import { useToasts } from "@/hooks/useToasts";
import ToastContainer from "@/components/Toast";
import { ArrowLeft, Loader2 } from "lucide-react";

/**
 * Édition d'une annonce par l'admin (modération) : charge les données via
 * GET /admin/listings/{id} et soumet via POST /admin/listings/{id}
 * (ListingForm avec updateEndpoint). Aucune vérification de propriétaire :
 * l'autorisation est garantie par le middleware 'admin' de l'API.
 */
export default function AdminListingEdit({
  user,
  listingId,
}: {
  user: { id: number; name: string; email: string; is_admin: boolean };
  listingId: number;
}) {
  const router = useRouter();
  const { toasts, pushToast, dismissToast } = useToasts();

  const [initialData, setInitialData] = useState<ListingFormProps["initialData"] | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get(`/admin/listings/${listingId}`)
      .then(({ data }) => {
        if (!active) return;
        setInitialData((data?.listing as ListingFormProps["initialData"]) ?? null);
      })
      .catch(() => {
        if (!active) return;
        setError("Impossible de charger l'annonce. Elle a peut-être été supprimée.");
      })
      .finally(() => {
        if (active) setIsLoadingData(false);
      });
    return () => {
      active = false;
    };
  }, [listingId]);

  if (isLoadingData) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#6D28D9]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-4">
        <div className="bg-rose-50 text-rose-700 p-6 rounded-xl shadow-sm text-center max-w-md">
          <p className="font-medium mb-4">{error}</p>
          <button
            onClick={() => router.push("/admin")}
            className="px-4 py-2 bg-rose-100 hover:bg-rose-200 rounded-md transition cursor-pointer"
          >
            Retour à l&apos;espace administrateur
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6D28D9] hover:text-violet-800 transition-colors mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Retour à l&apos;espace administrateur
          </Link>
          <h1 className="text-2xl font-black text-gray-950 leading-tight">Modifier l&apos;annonce</h1>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Édition en tant qu&apos;administrateur · connecté : {user.name} ({user.email})
          </p>
        </div>

        {initialData && (
          <ListingForm
            initialData={initialData}
            isEditMode={true}
            updateEndpoint={`/admin/listings/${listingId}`}
            onSubmitSuccess={() => {
              pushToast("L'annonce a été mise à jour avec succès");
              setTimeout(() => router.push("/admin"), 1200);
            }}
            onError={(message) => pushToast(message, "warning")}
          />
        )}
      </div>
      <ToastContainer toasts={toasts} dismiss={dismissToast} />
    </>
  );
}
