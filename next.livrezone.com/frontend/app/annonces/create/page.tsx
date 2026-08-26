"use client";

import React, { Component, ErrorInfo, ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import ListingForm from "@/components/ListingForm";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, AlertTriangle } from "lucide-react";
import ToastContainer from "@/components/Toast";
import { useToasts } from "@/hooks/useToasts";

interface ErrorBoundaryProps {
  children: ReactNode;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, {hasError: boolean, error: Error | null, info: ErrorInfo | null}> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error, info: null };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 rounded-xl border border-red-200 mt-8">
          <div className="flex items-center gap-3 text-red-700 font-bold mb-4">
            <AlertTriangle className="w-6 h-6" />
            Crash Client Détecté (ErrorBoundary)
          </div>
          <div className="text-sm text-red-900 bg-red-100 p-4 rounded-lg font-mono overflow-auto mb-4 whitespace-pre-wrap">
            {this.state.error?.toString()}
          </div>
          {this.state.info && (
            <div className="text-xs text-red-800 bg-red-100/50 p-4 rounded-lg font-mono overflow-auto whitespace-pre-wrap">
              {this.state.info.componentStack}
            </div>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

export default function CreateListingPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { toasts, pushToast, dismissToast } = useToasts();

  // Rediriger vers la connexion si non authentifié (side-effect dans un effet, jamais au render)
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  if (!isLoading && !user) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Publier une annonce</h1>
          <p className="mt-2 text-sm text-gray-600">Remplissez les détails de votre livre pour le proposer à la vente.</p>
        </div>

        <ErrorBoundary>
          <ListingForm 
            onSubmitSuccess={() => {
              pushToast("Votre annonce a été publiée avec succès");
              setTimeout(() => router.push("/dashboard"), 1200);
            }} 
            onError={(message) => pushToast(message, "warning")}
          />
        </ErrorBoundary>
      </div>
    </div>
    <ToastContainer toasts={toasts} dismiss={dismissToast} />
    </>
  );
}
