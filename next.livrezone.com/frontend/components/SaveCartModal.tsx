"use client";

import React from "react";
import Image from "next/image";
import { Clock, X } from "lucide-react";
import { useCommerce } from "@/lib/commerce-store";
import { useAuth } from "@/hooks/useAuth";

export default function SaveCartModal() {
  const { guestModalOpen, guestItem, guestModalType, closeGuestModal } =
    useCommerce();
  const { loginWithProvider } = useAuth();
  const [cgvAccepted, setCgvAccepted] = React.useState(false);
  const [cgvError, setCgvError] = React.useState(false);

  if (!guestModalOpen || !guestModalType) return null;

  const label =
    guestModalType === "cart" ? "panier" : "wishlist";

  // La connexion via Google peut créer un compte : les CGV doivent être
  // acceptées au préalable (même règle que la page /login).
  const handleLogin = () => {
    if (!cgvAccepted) {
      setCgvError(true);
      return;
    }
    void loginWithProvider("google");
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md p-4 mx-auto animate-in zoom-in-95 duration-200">
        <div className="relative bg-white shadow-2xl rounded-xl border-t-4 border-[#F97316] overflow-hidden">
          <button
            onClick={closeGuestModal}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-900 focus:outline-none p-1"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-6 text-center">
            {guestItem?.cover ? (
              <div className="w-16 h-20 mx-auto mb-4 relative overflow-hidden rounded-md border border-gray-100 shadow-sm">
                <Image
                  src={guestItem.cover}
                  alt={guestItem.title}
                  fill
                  sizes="64px"
                  className="object-contain"
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 bg-orange-50 text-[#F97316]">
                <Clock className="w-6 h-6" />
              </div>
            )}

            <h3 className="mb-1 text-lg font-bold text-gray-900">
              Sauvegardez votre {label}
            </h3>
            <p className="mb-5 text-xs text-gray-500 leading-relaxed">
              Visiteur invité : votre {label} sera conservé{" "}
              <strong className="text-gray-700">24 heures</strong> sur cet
              appareil. Connectez-vous pour le sauvegarder définitivement et le
              retrouver sur tous vos appareils.
            </p>

            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2 text-left">
                <input
                  id="save-cart-cgv"
                  type="checkbox"
                  checked={cgvAccepted}
                  onChange={(e) => {
                    setCgvAccepted(e.target.checked);
                    if (e.target.checked) setCgvError(false);
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 accent-[#6D28D9] focus:ring-2 focus:ring-[#6D28D9]/20"
                />
                <p className="text-xs text-gray-500 leading-relaxed">
                  <label
                    htmlFor="save-cart-cgv"
                    className="cursor-pointer"
                  >
                    J&apos;accepte les{' '}
                  </label>
                  <a
                    href="/cgv"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#6D28D9] hover:underline"
                  >
                    Conditions Générales d&apos;Utilisation et de Vente
                  </a>
                  .
                </p>
              </div>

              {cgvError && (
                <p className="text-xs font-medium text-rose-600">
                  Vous devez accepter les Conditions Générales pour continuer.
                </p>
              )}

              <button
                onClick={handleLogin}
                className="w-full h-11 rounded-lg text-xs font-bold text-white hover:opacity-95 transition-opacity flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                style={{ backgroundColor: "#1a0a40" }}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l2.66-2.84z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Se connecter pour sauvegarder
              </button>

              <button
                onClick={closeGuestModal}
                className="w-full h-11 rounded-lg text-xs font-bold text-[#1a0a40] bg-white border border-[#1a0a40] hover:bg-violet-50 transition-colors cursor-pointer"
              >
                Continuer en invité (valable 24h)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}