import type { Metadata } from "next";
import DemandesClient from "./DemandesClient";
import { parseFilters } from "@/lib/listings-filters";
import { getReferenceData } from "@/lib/listings-api";

export const revalidate = 30;

const SITE_URL = "https://next.livrezone.com";
const PATH = "/demandes";
const API_BASE = (process.env.INTERNAL_API_URL
  || process.env.NEXT_PUBLIC_API_URL
  || "https://api-next.livrezone.com").replace(/\/api\/?$/, "");

type SearchParams = Record<string, string | string[] | undefined>;

interface PageProps {
  searchParams: Promise<SearchParams>;
}

function paramGetter(searchParams: SearchParams) {
  return (key: string): string | null => {
    const value = searchParams[key];
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  };
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sp = await searchParams;
  const f = parseFilters(paramGetter(sp));
  const search = f.search;

  const title = search
    ? `Demandes de livres « ${search} » | LivreZone`
    : "Demandes de livres recherchés au Maroc | LivreZone";
  const description = search
    ? `Découvrez les acheteurs qui recherchent « ${search} » sur LivreZone. Vous avez ce livre ? Vendez-le facilement !`
    : "Consultez les livres recherchés par la communauté LivreZone au Maroc. Répondez aux demandes des lecteurs et vendez vos livres.";

  return {
    title,
    description,
    openGraph: { title, description, type: "website", locale: "fr_MA", siteName: "LivreZone" },
  };
}

async function getPublicDemandes(params: Record<string, string>) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/api/demandes?${query}`, {
      next: { revalidate: 30 },
      headers: { Accept: "application/json", Host: "api-next.livrezone.com" },
    });
    if (!res.ok) {
      return { data: [], total: 0, current_page: 1, last_page: 1 };
    }
    return await res.json();
  } catch {
    return { data: [], total: 0, current_page: 1, last_page: 1 };
  }
}

export default async function DemandesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const f = parseFilters(paramGetter(sp));

  const queryParams: Record<string, string> = {
    page: String(f.page || 1),
    limit: "12",
  };
  if (f.search) queryParams.search = f.search;
  if (f.categories.length) queryParams.category = f.categories.join(",");
  if (f.cities.length) queryParams.city = f.cities.join(",");
  if (f.languages.length) queryParams.language = f.languages.join(",");

  const [{ cities }, demandesRes] = await Promise.all([
    getReferenceData(),
    getPublicDemandes(queryParams),
  ]);

  return (
    <DemandesClient
      initialDemandes={demandesRes.data || []}
      initialTotal={demandesRes.total || 0}
      initialPage={demandesRes.current_page || 1}
      initialLastPage={demandesRes.last_page || 1}
      initialSearch={f.search}
      cities={cities}
    />
  );
}
