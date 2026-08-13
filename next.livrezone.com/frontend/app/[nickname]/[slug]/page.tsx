import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import ListingDetailsCard from "@/components/ListingDetailsCard";
import HorizontalGrid from "@/components/HorizontalGrid";

export const dynamic = 'force-dynamic';

interface Listing {
  id: number;
  user_id: number;
  title: string;
  description: string;
  book_condition: string;
  price: number;
  discount_price?: number | null;
  cover_path?: string | null;
  cover_source_url?: string | null;
  user: {
    id: number;
    name: string;
    profile?: {
      nickname: string;
      phone?: string | null;
      rating_average?: number;
      rating_count?: number;
      city?: {
        name: string;
      } | null;
    } | null;
  };
  book?: {
    isbn_13: string;
    publisher?: string | null;
    publication_date?: string | null;
    authors?: string[] | null;
    page_count?: number | null;
    cover_path?: string | null;
    cover_url?: string | null;
  } | null;
  category?: {
    name_fr: string;
    parent?: {
      name_fr: string;
    } | null;
  } | null;
  level?: {
    name_fr: string;
  } | null;
  subject?: {
    name_fr: string;
  } | null;
}

const getBaseUrl = () =>
  (process.env.INTERNAL_API_URL
    || process.env.NEXT_PUBLIC_API_URL
    || "https://api-next.livrezone.com").replace(/\/api\/?$/, '');

async function getListingDetail(id: string): Promise<Listing | null> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/listings/${id}`, {
      cache: "no-store",
      headers: { 'Accept': 'application/json', 'Host': 'api-next.livrezone.com' }
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch (e) {
    console.error("[SSR] getListingDetail error:", String(e));
    return null;
  }
}

async function getOtherListings(userId: number, excludeId: number) {
  try {
    const res = await fetch(
      `${getBaseUrl()}/api/listings?user_id=${userId}&exclude=${excludeId}&limit=12`,
      {
        cache: "no-store",
        headers: { 'Accept': 'application/json', 'Host': 'api-next.livrezone.com' }
      }
    );
    if (!res.ok) return [];
    const json = await res.json();
    return json.data && json.data.length > 0 ? json.data : [];
  } catch (e) {
    return [];
  }
}

interface PageProps {
  params: Promise<{
    nickname: string;
    slug: string;
  }>;
}

export default async function ListingPage({ params }: PageProps) {
  const { slug } = await params;

  // Extract ID from slug (matches "123-rest-of-slug")
  const match = slug.match(/^(\d+)-(.*)$/);
  if (!match) return notFound();

  const id = match[1];
  const listing = await getListingDetail(id);

  if (!listing) return notFound();

  // Fetch related listings from the same seller
  const otherListings = await getOtherListings(listing.user.id, listing.id);

  // Construct breadcrumbs
  const parentCategory = listing.category?.parent?.name_fr;
  const categoryName = listing.category?.name_fr;
  const breadcrumbCategory = parentCategory && categoryName
    ? `${parentCategory} › ${categoryName}`
    : categoryName || "Livres";

  return (
    <div className="w-[90%] max-w-7xl mx-auto py-8">
      {/* Breadcrumbs */}
      <nav className="mb-8 text-xs md:text-sm font-semibold text-gray-500 flex items-center gap-1.5 flex-wrap">
        <Link href="/" className="hover:text-[#F97316] transition-colors">
          Accueil
        </Link>
        <ChevronRight className="w-4 h-4 text-gray-400" />
        <span className="hover:text-[#F97316] transition-colors cursor-default">
          {breadcrumbCategory}
        </span>
        {listing.level && (
          <>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <span className="hover:text-[#F97316] transition-colors cursor-default">
              {listing.level.name_fr}
            </span>
          </>
        )}
        <ChevronRight className="w-4 h-4 text-gray-400" />
        <span className="text-gray-900 font-bold max-w-[200px] sm:max-w-none truncate">
          {listing.title}
        </span>
      </nav>

      {/* Main Details Card */}
      <ListingDetailsCard listing={listing} />

      {/* Other listings from same seller */}
      {otherListings.length > 0 && (
        <div className="mt-16 pt-8 border-t border-gray-100">
          <HorizontalGrid
            title={`Autres annonces de ${listing.user.profile?.nickname || listing.user.name}`}
            listings={otherListings as any}
          />
        </div>
      )}
    </div>
  );
}
