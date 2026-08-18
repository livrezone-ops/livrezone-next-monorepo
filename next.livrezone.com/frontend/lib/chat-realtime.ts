"use client";

import Echo from "laravel-echo";
import Pusher from "pusher-js";
import type { ChatMessage } from "./chat-api";

const REVERB_APP_KEY = process.env.NEXT_PUBLIC_REVERB_APP_KEY || "";
const REVERB_HOST = process.env.NEXT_PUBLIC_REVERB_HOST || "api-next.livrezone.com";
const REVERB_PORT = process.env.NEXT_PUBLIC_REVERB_PORT || "443";
const REVERB_SCHEME = process.env.NEXT_PUBLIC_REVERB_SCHEME || "https";

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
  echoInstance = new Echo({
    broadcaster: "reverb",
    key: REVERB_APP_KEY,
    wsHost: REVERB_HOST,
    wssPort: useTLS ? Number(REVERB_PORT) : 0,
    wsPort: useTLS ? 0 : Number(REVERB_PORT),
    forceTLS: useTLS,
    enabledTransports: useTLS ? ["wss"] : ["ws"],
    disableStats: true,
  });

  return echoInstance;
}

export function subscribeToThread(
  threadId: number,
  handler: (data: ChatMessage) => void
): (() => void) | undefined {
  const echo = getEcho();
  if (!echo) return;
  const channel = echo.private(`chat.thread.${threadId}`);
  channel.listen(".message.sent", handler);

  return () => {
    channel.stopListening(".message.sent");
  };
}