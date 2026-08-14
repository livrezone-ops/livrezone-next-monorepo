"use client";

import React from "react";
import { CheckCircle2, Info, AlertTriangle, X } from "lucide-react";

export type ToastType = "success" | "info" | "warning";

export interface ToastData {
  id: number;
  message: string;
  type: ToastType;
  leaving?: boolean;
}

const styles: Record<
  ToastType,
  { icon: React.ReactNode; box: string; iconWrap: string }
> = {
  success: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    box: "border-emerald-100",
    iconWrap: "bg-emerald-50 text-emerald-600",
  },
  info: {
    icon: <Info className="w-4 h-4" />,
    box: "border-[#6D28D9]/20",
    iconWrap: "bg-[#6D28D9]/10 text-[#6D28D9]",
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4" />,
    box: "border-amber-200",
    iconWrap: "bg-amber-50 text-amber-600",
  },
};

export default function ToastContainer({
  toasts,
  dismiss,
  fixed = true,
}: {
  toasts: ToastData[];
  dismiss: (id: number) => void;
  fixed?: boolean;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className={`${fixed ? "fixed top-5 right-5 z-[100]" : ""} flex flex-col gap-3 items-end pointer-events-none`}>
      {toasts.map((t) => {
        const s = styles[t.type];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 bg-white border ${s.box} rounded-xl shadow-lg pl-3 pr-2 py-2.5 max-w-xs ${
              t.leaving ? "animate-toast-out" : "animate-toast-in"
            }`}
          >
            <span
              className={`flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 ${s.iconWrap}`}
            >
              {s.icon}
            </span>
            <span className="text-xs font-bold text-gray-800 leading-snug">
              {t.message}
            </span>
            <button
              onClick={() => dismiss(t.id)}
              className="p-1 text-gray-300 hover:text-gray-600 cursor-pointer transition-colors flex-shrink-0"
              aria-label="Fermer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}