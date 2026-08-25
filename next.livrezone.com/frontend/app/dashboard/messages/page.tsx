import React, { Suspense } from "react";
import ChatClient from "@/components/ChatClient";
import PendingAuthRedirect from "@/components/PendingAuthRedirect";

export const dynamic = "force-dynamic";

// Données privées du dashboard : chargées côté client (Axios + TanStack Query).
export default function MessagesPage() {
  return (
    <div className="py-4 lg:py-2">
      <PendingAuthRedirect />
      <Suspense fallback={null}>
        <ChatClient />
      </Suspense>
    </div>
  );
}
