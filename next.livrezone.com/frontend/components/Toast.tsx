"use client";

import React, { createContext, useContext, useState, useRef, useCallback } from "react";
import { CheckCircle2, Info, AlertTriangle, X } from "lucide-react";

export type ToastType = "success" | "info" | "warning" | "error";

export interface ToastData {
  id: number;
  message: string;
  type: ToastType;
  leaving?: boolean;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback if rendered outside of provider
    return {
      showToast: (message: string) => {
        if (typeof window !== "undefined") console.log(message);
      },
      success: (message: string) => {
        if (typeof window !== "undefined") console.log(message);
      },
      error: (message: string) => {
        if (typeof window !== "undefined") console.error(message);
      },
      info: (message: string) => {
        if (typeof window !== "undefined") console.info(message);
      },
      warning: (message: string) => {
        if (typeof window !== "undefined") console.warn(message);
      },
    };
  }
  return context;
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
  error: {
    icon: <AlertTriangle className="w-4 h-4" />,
    box: "border-red-200",
    iconWrap: "bg-red-50 text-red-600",
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const toastIdRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
      );
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 300);
    }, 3600);
  }, []);

  const success = useCallback((message: string) => showToast(message, "success"), [showToast]);
  const error = useCallback((message: string) => showToast(message, "error"), [showToast]);
  const info = useCallback((message: string) => showToast(message, "info"), [showToast]);
  const warning = useCallback((message: string) => showToast(message, "warning"), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} fixed={true} />
    </ToastContext.Provider>
  );
}

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
            className={`pointer-events-auto flex items-center gap-3 bg-white border ${s.box} rounded-xl shadow-lg pl-3.5 pr-2.5 py-3 max-w-sm ${
              t.leaving ? "animate-toast-out" : "animate-toast-in"
            }`}
          >
            <span
              className={`flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 ${s.iconWrap}`}
            >
              {s.icon}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-slate-800 leading-snug">
              {t.message}
            </span>
            <button
              onClick={() => dismiss(t.id)}
              className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer transition-colors flex-shrink-0 ml-auto"
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