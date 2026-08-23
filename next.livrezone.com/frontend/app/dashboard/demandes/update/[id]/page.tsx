"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Edit, Loader2 } from "lucide-react";
import OrderForm, { OrderFormData } from "@/components/OrderForm";
import Breadcrumbs from "@/components/Breadcrumbs";
import api from "@/lib/axios";
import { useToast } from "@/components/Toast";
import { useRouter } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function UpdateDemandePage({ params }: PageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { error: toastError } = useToast();
  const [order, setOrder] = useState<OrderFormData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const { data } = await api.get(`/orders/${resolvedParams.id}`);
        setOrder(data.order || null);
      } catch (err: any) {
        console.error("Erreur chargement demande:", err);
        toastError("Impossible de charger cette demande.");
        router.push("/dashboard/demandes");
      } finally {
        setLoading(false);
      }
    };

    if (resolvedParams.id) {
      fetchOrder();
    }
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-80">
        <Loader2 className="animate-spin h-9 w-9 text-[#6D28D9]" />
      </div>
    );
  }

  return (
    <div className="w-[92%] max-w-3xl mx-auto py-8">
      <Breadcrumbs
        items={[
          { label: "Mes demandes", href: "/dashboard/demandes" },
          { label: order?.title ? `Modifier : ${order.title}` : "Modifier la demande" },
        ]}
      />

      <div className="mb-6">
        <Link
          href="/dashboard/demandes"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-black mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à mes demandes
        </Link>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
          <Edit className="w-7 h-7 text-[#6D28D9]" /> Modifier la demande
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Mettez à jour les informations de votre recherche.
        </p>
      </div>

      <OrderForm isEditing={true} initialData={order} />
    </div>
  );
}
