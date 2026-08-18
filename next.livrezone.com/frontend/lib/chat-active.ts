"use client";

// Statut partagé « une conversation de chat est ouverte » entre ChatClient et Header.

type Listener = (active: boolean) => void;

let active = false;
const listeners = new Set<Listener>();

export function setChatActive(value: boolean) {
  if (active === value) return;
  active = value;
  listeners.forEach((l) => l(value));
}

export function getChatActive(): boolean {
  return active;
}

export function subscribeChatActive(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}