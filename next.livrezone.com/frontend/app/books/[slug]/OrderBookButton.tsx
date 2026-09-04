"use client";

import { useState } from "react";
import api from "@/lib/axios";
import { getApiErrorMessage } from "@/lib/api-error";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { Bell, Loader2, Check } from "lucide-react";
import { useToast } from "@/components/Toast";

export default function OrderBookButton({ bookId }: { bookId: number }) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [loading, setLoading] = useState(false);
  const [ordered, setOrdered] = useState(false);

  const handleOrder = async () => {
    if (!isAuthenticated) {
      toastError("Veuillez vous connecter pour faire une demande.");
      router.push("/login");
      return;
    }

    setLoading(true);
    try {
      await api.post("/orders", { book_id: bookId });
      success("Votre demande a bien été enregistrée ! Les vendeurs Pro/Premium seront alertés.");
      setOrdered(true);
    } catch (error) {
      const msg = getApiErrorMessage(error, "Erreur lors de la création de la demande.");
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (ordered) {
    return (
      <button
        disabled
        className="px-4 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs cursor-default"
      >
        <Check className="w-4 h-4" /> Demande enregistrée
      </button>
    );
  }

  return (
    <button
      onClick={handleOrder}
      disabled={loading}
      className="px-4 py-2.5 bg-white border border-[#6D28D9] text-[#6D28D9] hover:bg-violet-50 text-xs sm:text-sm font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4 text-[#6D28D9]" />}
      Créer une demande de ce livre
    </button>
  );
}
