"use client";

import Echo from "laravel-echo";
import Pusher from "pusher-js";
import type { ChatMessage } from "./chat-api";

const REVERB_APP_KEY = process.env.NEXT_PUBLIC_REVERB_APP_KEY || "";
const REVERB_HOST = process.env.NEXT_PUBLIC_REVERB_HOST || "api-next.livrezone.com";
const REVERB_PORT = process.env.NEXT_PUBLIC_REVERB_PORT || "443";
const REVERB_SCHEME = process.env.NEXT_PUBLIC_REVERB_SCHEME || "https";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api-next.livrezone.com/api";

const AUTH_ENDPOINT = `${API_URL.replace(/\/api\/?$/, "")}/broadcasting/auth`;

let echoInstance: Echo<'reverb'> | null = null;

declare global {
  interface Window {
    Pusher: typeof Pusher;
  }
}

if (typeof window !== "undefined") {
  window.Pusher = Pusher;
}

export function getEcho(): Echo<'reverb'> | null {
  if (typeof window === "undefined") return null;
  if (echoInstance) return echoInstance;

  if (!REVERB_APP_KEY) {
    console.warn("Chat temps réel : NEXT_PUBLIC_REVERB_APP_KEY absent.");
    return null;
  }

  const useTLS = REVERB_SCHEME === "https";

  // Client Pusher avec un authorizer custom : la requête d'autorisation des
  // canaux privés part vers l'API (api-next) avec les cookies Sanctum, ce que
  // l'autorizer par défaut de Pusher ne fait pas en cross-origin.
  const pusher = new Pusher(REVERB_APP_KEY, {
    cluster: "",
    wsHost: REVERB_HOST,
    wssPort: useTLS ? Number(REVERB_PORT) : 0,
    wsPort: useTLS ? 0 : Number(REVERB_PORT),
    forceTLS: useTLS,
    enabledTransports: useTLS ? ["wss"] : ["ws"],
    disableStats: true,
    // Authorizer custom : la requête d'autorisation des canaux privés part vers
    // l'API (api-next) avec les cookies Sanctum, ce que l'autorizer par défaut
    // de Pusher ne fait pas en cross-origin.
    authorizer: (channel) => ({
      authorize: (socketId, callback) => {
        const body = new URLSearchParams({
          socket_id: socketId,
          channel_name: channel.name,
        });

        fetch(AUTH_ENDPOINT, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        })
          .then((response) => response.json())
          .then((data) => callback(null, data))
          .catch((err) =>
            callback(err instanceof Error ? err : new Error(String(err)), null)
          );
      },
    }),
  });

  echoInstance = new Echo({
    broadcaster: "reverb",
    client: pusher,
  });

  return echoInstance;
}

export interface ThreadHandlers {
  onMessage?: (data: ChatMessage) => void;
  onUpdated?: (data: { id: number; message: string; updated_at: string }) => void;
  onDeleted?: (data: { id: number }) => void;
}

export function subscribeToThread(
  threadId: number,
  handlers: ThreadHandlers
): (() => void) | undefined {
  const echo = getEcho();
  if (!echo) return;
  const channel = echo.private(`chat.thread.${threadId}`);

  if (handlers.onMessage) channel.listen(".message.sent", handlers.onMessage);
  if (handlers.onUpdated) channel.listen(".message.updated", handlers.onUpdated);
  if (handlers.onDeleted) channel.listen(".message.deleted", handlers.onDeleted);

  return () => {
    channel.stopListening(".message.sent");
    channel.stopListening(".message.updated");
    channel.stopListening(".message.deleted");
  };
}
