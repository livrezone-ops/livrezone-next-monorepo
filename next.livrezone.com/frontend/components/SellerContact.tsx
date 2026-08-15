"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, MessageCircle, Phone, MessageSquare, X } from "lucide-react";

interface SellerContactProps {
  phone?: string | null;
  userId: number;
}

export default function SellerContact({ phone, userId }: SellerContactProps) {
  const [open, setOpen] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Normalisation du numéro marocain pour WhatsApp (212).
  const clean = (phone || "").replace(/[^0-9]/g, "");
  let waPhone = clean;
  if (waPhone.startsWith("0")) waPhone = "212" + waPhone.substring(1);
  const waLink = waPhone ? `https://wa.me/${waPhone}` : "#";
  const telLink = clean ? `tel:+${clean}` : "#";

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a0a40] text-white text-xs font-bold hover:bg-[#2d1b6e] transition-colors shadow-sm"
      >
        Contacter
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-40 bg-white rounded-lg shadow-xl border border-gray-100 left-1/2 md:left-0 -translate-x-1/2 md:translate-x-0 origin-top">
          {waPhone ? (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#25D366] hover:bg-gray-50 rounded-t-lg transition-colors border-b border-gray-50"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setShowPhoneModal(true);
            }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-50 cursor-pointer"
          >
            <Phone className="w-4 h-4" />
            Appeler
          </button>
          <Link
            href={`/chat?user=${userId}`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 rounded-b-lg transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            Message
          </Link>
        </div>
      )}

      {/* Phone Call Modal */}
      {showPhoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="relative w-full max-w-sm bg-white shadow-2xl rounded-xl border-t-4 border-[#1a0a40] overflow-hidden">
            <button
              onClick={() => setShowPhoneModal(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-900 focus:outline-none p-1 cursor-pointer"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 bg-gray-50 text-[#1a0a40]">
                <Phone className="w-6 h-6" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-gray-900">
                Contact Téléphonique
              </h3>
              <p className="mb-6 text-xs text-gray-500 leading-normal">
                Vous pouvez appeler le vendeur directement sur son numéro de
                téléphone marocain :
              </p>

              <div className="text-xl font-black tracking-wider text-gray-900 mb-6 bg-gray-50 py-3 rounded-lg border border-gray-100 font-mono">
                {phone || "Numéro non renseigné"}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPhoneModal(false)}
                  className="w-1/2 py-2.5 rounded-lg text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                {phone ? (
                  <a
                    href={telLink}
                    className="w-1/2 py-2.5 rounded-lg text-xs font-bold text-white hover:opacity-90 flex items-center justify-center gap-1.5 transition-opacity cursor-pointer"
                    style={{ backgroundColor: "#1a0a40" }}
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Appeler
                  </a>
                ) : (
                  <button
                    disabled
                    className="w-1/2 py-2.5 rounded-lg text-xs font-bold text-gray-400 bg-gray-100 border border-gray-200 cursor-not-allowed"
                  >
                    Indisponible
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}