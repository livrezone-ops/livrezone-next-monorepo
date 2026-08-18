import React, { Suspense } from "react";
import ChatClient from "@/components/ChatClient";
import PendingAuthRedirect from "@/components/PendingAuthRedirect";

export const dynamic = "force-dynamic";

// Données privées du dashboard : chargées côté client (Axios + TanStack Query).
export default function MessagesPage() {
  return (
    <div className="w-[90%] max-w-7xl mx-auto py-8">
      <PendingAuthRedirect />
      <Suspense fallback={null}>
        <ChatClient />
      </Suspense>
    </div>
  );
}
