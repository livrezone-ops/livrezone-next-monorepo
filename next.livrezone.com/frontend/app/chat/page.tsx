"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getOrCreateThread } from "@/lib/chat-api";
import { useAuth } from "@/hooks/useAuth";
import PendingAuthRedirect from "@/components/PendingAuthRedirect";

function ContactHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();
  const userId = searchParams.get("user");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    const id = Number(userId);
    if (!userId || Number.isNaN(id)) {
      router.replace("/dashboard/messages");
      return;
    }
    let active = true;
    getOrCreateThread(id)
      .then(({ id: threadId }) => {
        if (active) router.replace(`/dashboard/messages?thread=${threadId}`);
      })
      .catch(() => {
        if (active) setError("Impossible de démarrer la conversation.");
      });
    return () => {
      active = false;
    };
  }, [isLoading, isAuthenticated, userId, router]);

  return (
    <div className="w-[90%] max-w-7xl mx-auto py-8">
      <PendingAuthRedirect />
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-gray-500">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">{error ?? "Ouverture de la conversation…"}</p>
      </div>
    </div>
  );
}

export default function ChatRedirectPage() {
  return (
    <Suspense fallback={null}>
      <ContactHandler />
    </Suspense>
  );
}
