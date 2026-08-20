import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { cookies } from "next/headers";
import type { HeroMessage } from "@/components/home/types";
import { isValidMessage, validateHref } from "@/components/home/types";

export const dynamic = "force-dynamic";

const HERO_FILE = () => path.join(process.cwd(), "data", "hero-messages.json");

function readMessages(): HeroMessage[] {
  try {
    const raw = fs.readFileSync(HERO_FILE(), "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isValidMessage)
      .map((m) => ({
        ...m,
        primaryAction: { ...m.primaryAction, href: validateHref(m.primaryAction.href) },
        secondaryAction: m.secondaryAction
          ? { ...m.secondaryAction, href: validateHref(m.secondaryAction.href) }
          : undefined,
      }));
  } catch {
    return [];
  }
}

// Vérifie que l'utilisateur courant est bien admin (session Laravel Sanctum).
async function isAdmin(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");

    const baseUrl = (process.env.INTERNAL_API_URL
      || process.env.NEXT_PUBLIC_API_URL
      || "https://api-next.livrezone.com").replace(/\/api\/?$/, "");

    const res = await fetch(`${baseUrl}/api/user`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Host: "api-next.livrezone.com",
        Cookie: cookieHeader,
        Referer: "https://next.livrezone.com",
      },
    });
    if (!res.ok) return false;
    const user = await res.json();
    return user?.is_admin === true;
  } catch {
    return false;
  }
}

export async function GET() {
  return NextResponse.json({ messages: readMessages() });
}

export async function PUT(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 403 });
  }

  let body: { messages?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const raw = body?.messages;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ error: "Le champ messages doit être un tableau non vide." }, { status: 422 });
  }

  const messages = raw.map((m) => ({
    ...m,
    primaryAction: m.primaryAction
      ? { ...m.primaryAction, href: validateHref(m.primaryAction.href) }
      : m.primaryAction,
    secondaryAction: m.secondaryAction
      ? { ...m.secondaryAction, href: validateHref(m.secondaryAction.href) }
      : m.secondaryAction,
  }));

  if (!messages.every(isValidMessage)) {
    return NextResponse.json({ error: "Un ou plusieurs messages sont invalides." }, { status: 422 });
  }

  try {
    fs.writeFileSync(HERO_FILE(), JSON.stringify(messages, null, 2), "utf-8");
  } catch (e) {
    console.error("[api] hero-messages write error:", String(e));
    return NextResponse.json({ error: "Impossible d'écrire le fichier JSON." }, { status: 500 });
  }

  return NextResponse.json({ message: "Messages du hero enregistrés avec succès.", messages });
}