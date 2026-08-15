export type HeroAction = {
  label: string;
  href: string;
};

export type HeroMessage = {
  id: number;
  language: "fr" | "ar";
  direction: "ltr" | "rtl";
  title: string;
  description: string;
  primaryAction: HeroAction;
  secondaryAction?: HeroAction;
};

export const ALLOWED_HREFS = [
  "/annonces",
  "/listing/create",
  "/profile/complete",
  "/",
] as const;

export function validateHref(href: string, fallback = "/annonces"): string {
  return ALLOWED_HREFS.includes(href as any) ? href : fallback;
}

// Validation basique d'un message brut
export function isValidMessage(raw: unknown): raw is HeroMessage {
  if (!raw || typeof raw !== "object") return false;
  const m = raw as Record<string, unknown>;
  if (typeof m.id !== "number") return false;
  if (m.language !== "fr" && m.language !== "ar") return false;
  if (m.direction !== "ltr" && m.direction !== "rtl") return false;
  if (typeof m.title !== "string" || !m.title.trim()) return false;
  if (typeof m.description !== "string" || !m.description.trim()) return false;
  if (!m.primaryAction || typeof m.primaryAction !== "object") return false;
  const pa = m.primaryAction as Record<string, unknown>;
  if (typeof pa.label !== "string" || !pa.label.trim()) return false;
  if (typeof pa.href !== "string" || !pa.href.trim()) return false;
  return true;
}