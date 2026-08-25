import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export interface AdminAuthUser {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
}

export async function getAdminUser(): Promise<AdminAuthUser | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const baseUrl = (
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "https://api-next.livrezone.com"
    ).replace(/\/api\/?$/, "");

    const res = await fetch(`${baseUrl}/api/user`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Host: "api-next.livrezone.com",
        Cookie: cookieHeader,
        Referer: "https://next.livrezone.com",
      },
    });

    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error("[SSR] admin getAdminUser error:", e);
    return null;
  }
}

/**
 * Garde de route admin : redirige vers /login si non authentifié.
 * Retourne null si l'utilisateur n'est pas admin (la page affiche alors l'accès refusé).
 */
export async function requireAdminUser(): Promise<AdminAuthUser> {
  const user = await getAdminUser();
  if (!user) {
    redirect("/login");
    throw new Error("Unreachable : redirect interrompt l'exécution.");
  }
  return user;
}
