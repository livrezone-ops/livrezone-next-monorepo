import React from "react";
import HorizontalGrid from "@/components/HorizontalGrid";

interface Listing {
  id: number;
  user_id: number;
  title: string;
  price: number;
  discount_price?: number | null;
  book_condition: string;
  isbn_13?: string | null;
  cover_path?: string | null;
  cover_source_url?: string | null;
  book?: {
    isbn_13?: string | null;
    authors?: string[] | string | null;
    cover_url?: string | null;
  } | null;
  user?: {
    id: number;
    profile?: {
      nickname?: string | null;
      city?: {
        name?: string | null;
      } | null;
    } | null;
  } | null;
}

const mockListings: Listing[] = [];

async function getListings(category?: string): Promise<Listing[]> {
  try {
    const baseUrl = (process.env.INTERNAL_API_URL
      || process.env.NEXT_PUBLIC_API_URL
      || "https://api-next.livrezone.com").replace(/\/api\/?$/, '');

    const url = category
      ? `${baseUrl}/api/listings?category=${category}&limit=12`
      : `${baseUrl}/api/listings?limit=12`;

    const res = await fetch(url, {
      next: { revalidate: 60 },
      headers: { 'Accept': 'application/json', 'Host': 'api-next.livrezone.com' }
    });
    if (!res.ok) return mockListings;

    const json = await res.json();
    return json.data && json.data.length > 0 ? json.data : mockListings;
  } catch (e) {
    console.error("[SSR] getListings error:", String(e));
    return mockListings;
  }
}

export default async function Home() {
  // On charge les vraies catégories présentes dans la base :
  // - Sans filtre = Nouveautés (toutes catégories)
  // - ROMANS  → catégorie qui a des annonces
  // - JEUNESSE → catégorie qui a des annonces
  // - Sans catégorie (category_id IS NULL) → livres divers
  const [nouveautes, romans, jeunesse, divers] = await Promise.all([
    getListings(),
    getListings("romans"),
    getListings("jeunesse"),
    getListings("vie-pratique"),
  ]);

  return (
    <div className="w-[90%] max-w-7xl mx-auto py-12 flex flex-col gap-6">
      <HorizontalGrid title="Nouveautés" listings={nouveautes} viewAllUrl="/annonces" />
      {romans.length > 0 && (
        <HorizontalGrid title="Romans & Littérature" listings={romans} viewAllUrl="/annonces?category=romans" />
      )}
      {jeunesse.length > 0 && (
        <HorizontalGrid title="Jeunesse" listings={jeunesse} viewAllUrl="/annonces?category=jeunesse" />
      )}
      {divers.length > 0 && (
        <HorizontalGrid title="Vie Pratique" listings={divers} viewAllUrl="/annonces?category=vie-pratique" />
      )}
    </div>
  );
}
