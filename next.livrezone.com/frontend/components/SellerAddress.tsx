"use client";

import { useState } from "react";
import { MapPin, X } from "lucide-react";

export default function SellerAddress({ address }: { address: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex flex-shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-100 text-xs font-semibold text-gray-600 hover:border-[#6D28D9] hover:text-[#6D28D9] transition-colors cursor-pointer"
        aria-label="Voir l'adresse"
      >
        <MapPin className="w-3.5 h-3.5 text-gray-400" />
        Adresse
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-200 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-900 focus:outline-none p-1 cursor-pointer"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="mb-3 text-lg font-bold text-gray-900">Adresse</h3>
            <p className="text-sm text-gray-700 leading-relaxed">{address}</p>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setOpen(false)}
                className="bg-[#1a0a40] hover:bg-[#6D28D9] text-white text-sm font-bold px-6 py-2.5 rounded-lg transition-colors cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}