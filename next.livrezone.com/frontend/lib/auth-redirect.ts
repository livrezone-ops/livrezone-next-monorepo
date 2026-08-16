const PENDING_KEY = "livrezone.pendingRedirect";

export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export function rememberNextPath(path: string): void {
  if (typeof window === "undefined") return;
  const destination = safeNextPath(path);
  if (!destination) return;
  try {
    sessionStorage.setItem(PENDING_KEY, destination);
  } catch {}
}

export function consumePendingPath(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
    return value;
  } catch {
    return null;
  }
}