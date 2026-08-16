"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { consumePendingPath, safeNextPath } from "@/lib/auth-redirect";

export default function PendingAuthRedirect() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    const next = safeNextPath(consumePendingPath());
    if (next) router.replace(next);
  }, [user, router]);

  return null;
}