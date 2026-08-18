"use client";

// Petits bips de notification via Web Audio API (pas de fichier audio).

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

function beep(
  c: AudioContext,
  freq: number,
  start: number,
  duration: number,
  volume = 0.15
) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(start);
  osc.stop(start + duration);
}

export function playMessageSound(kind: "sent" | "received") {
  const c = getCtx();
  if (!c) return;
  try {
    const t = c.currentTime + 0.01;
    if (kind === "sent") {
      beep(c, 520, t, 0.15);
    } else {
      beep(c, 780, t, 0.12);
      beep(c, 1040, t + 0.16, 0.14);
    }
  } catch {
    // Ignore si l'audio est indisponible.
  }
}