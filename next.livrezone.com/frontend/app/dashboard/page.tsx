import React from "react";
import DashboardClient from "@/components/DashboardClient";
import PendingAuthRedirect from "@/components/PendingAuthRedirect";
import { redirect } from 'next/navigation';

// Forcer le rendu dynamique (SSR) — obligatoire car on utilise cache: no-store
export const dynamic = 'force-dynamic';

interface Listing {
  id: number;
  title: string;
  price: number;
  discount_price?: number | null;
  book_condition: string;
  isbn_13?: string | null;
  status: string;
  created_at: string;
  cover_path?: string | null;
  cover_source_url?: string | null;
  book?: {
    cover_url?: string | null;
    authors?: string[] | string | null;
  } | null;
  category?: {
    name_fr: string;
  } | null;
}

import { cookies } from 'next/headers';

async function getDashboardData(): Promise<Listing[] | null> {
  try {
    const cookieStore = await cookies();
    // Convert array of cookies into a standard Cookie header string
    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');

    const baseUrl = (process.env.INTERNAL_API_URL 
      || process.env.NEXT_PUBLIC_API_URL 
      || "https://api-next.livrezone.com").replace(/\/api\/?$/, '');

    // 1. Fetch current authenticated user
    const userRes = await fetch(`${baseUrl}/api/user`, {
      cache: "no-store",
      headers: { 
        'Accept': 'application/json', 
        'Host': 'api-next.livrezone.com',
        'Cookie': cookieHeader,
        'Referer': 'https://next.livrezone.com'
      }
    });

    if (!userRes.ok) {
        console.error("[SSR] Could not fetch user, status:", userRes.status);
        return null; // Return null to indicate unauthorized
    }

    await userRes.json();

    // 2. Fetch dashboard listings for this user (authentifié)
    const res = await fetch(`${baseUrl}/api/dashboard/listings?limit=100&filter=all`, {
      cache: "no-store",
      headers: { 
        'Accept': 'application/json', 
        'Host': 'api-next.livrezone.com',
        'Cookie': cookieHeader,
        'Referer': 'https://next.livrezone.com'
      }
    });
    
    if (!res.ok) return [];
    
    const json = await res.json();
    return json.listings && Array.isArray(json.listings) ? json.listings : [];
  } catch (e) {
    console.error("[SSR] getDashboardData error:", e);
    return []; // Network errors for listings can return empty array, but if auth failed earlier it returns null.
  }
}

export default async function DashboardPage() {
  const listings = await getDashboardData();
  // If listings is null, it means authentication failed
  if (listings === null) {
    redirect('/login');
  }

  return (
    <div className="w-[90%] max-w-7xl mx-auto py-8">
      <PendingAuthRedirect />
      <DashboardClient initialListings={listings} />
    </div>
  );
}
