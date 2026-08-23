"use client";

import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import OrderForm from "@/components/OrderForm";
import Breadcrumbs from "@/components/Breadcrumbs";

export default function CreateDemandePage() {
  return (
    <div className="w-[92%] max-w-3xl mx-auto py-8">
      <Breadcrumbs
        items={[
          { label: "Mes demandes", href: "/dashboard/demandes" },
          { label: "Nouvelle demande" },
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
          <Sparkles className="w-7 h-7 text-[#6D28D9]" /> Déposer une demande de livre
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Remplissez les détails du livre que vous cherchez. Les vendeurs Pro et Premium seront alertés.
        </p>
      </div>

      <OrderForm isEditing={false} />
    </div>
  );
}
