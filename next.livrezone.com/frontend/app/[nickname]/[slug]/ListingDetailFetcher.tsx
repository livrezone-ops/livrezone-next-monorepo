"use client";

import { useQuery } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import api from "@/lib/axios";
import ListingDetailsCard from "@/components/ListingDetailsCard";
import HorizontalGrid from "@/components/HorizontalGrid";

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
  isbn_13?: string | null;
  user: {
    id: number;
    name: string;
    profile?: {
      nickname: string;
      phone?: string | null;
      rating_average?: number;
      rating_count?: number;
      city?: { name: string } | null;
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
    parent?: { name_fr: string } | null;
  } | null;
  level?: { name_fr: string; code?: string } | null;
  subject?: { name_fr: string; code?: string } | null;
}

const NON_APPLICABLE = "NON_APPLICABLE";

interface SlimListing {
  id: number;
  title: string;
  price: number;
  discount_price: number | null;
  book_condition: string;
  authors: string | null;
  coverUrl: string | null;
  url: string;
  city: string | null;
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function toSlimListing(listing: Listing): SlimListing {
  const authors = listing.book?.authors
    ? Array.isArray(listing.book.authors)
      ? listing.book.authors.join(", ")
      : listing.book.authors
    : null;

  let coverUrl =
    listing.book?.cover_url ||
    (listing.cover_path
      ? `https://api-next.livrezone.com/storage/${listing.cover_path}`
      : null) ||
    listing.cover_source_url ||
    null;

  if (
    coverUrl &&
    coverUrl.includes("/book-cover-proxy/") &&
    !coverUrl.includes("/thumbnails/")
  ) {
    coverUrl = coverUrl.replace("/book-cover-proxy/", "/book-cover-proxy/thumbnails/320/");
  }

  const nickname =
    listing.user.profile?.nickname || `utilisateur-${listing.user.id}`;
  const isbn = listing.book?.isbn_13 || listing.isbn_13 || "livre";
  const titleSlug = slugify(listing.title);
  const url = `/${nickname}/${listing.id}-${isbn}-${titleSlug}`;

  return {
    id: listing.id,
    title: listing.title,
    price: listing.price,
    discount_price: listing.discount_price ?? null,
    book_condition: listing.book_condition,
    authors,
    coverUrl,
    url,
    city: listing.user.profile?.city?.name || null,
  };
}

export default function ListingDetailFetcher({
  id,
  initialListing,
}: {
  id: string;
  initialListing?: Listing;
}) {
  const { data: queryListing, error } = useQuery<Listing>({
    queryKey: ["listing", id],
    queryFn: async () => {
      const { data } = await api.get(`/listings/${id}`);
      return data.data;
    },
    initialData: initialListing,
    retry: false,
  });

  const listing = queryListing || initialListing;

  if (!listing) {
    return (
      <div className="w-[90%] max-w-7xl mx-auto py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-96 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return <ListingDetailContent listing={listing} />;
}

function ListingDetailContent({ listing }: { listing: Listing }) {
  const { data: otherListings } = useQuery<Listing[]>({
    queryKey: ["listings", "user", listing.user.id, "exclude", listing.id],
    queryFn: async () => {
      const { data } = await api.get(`/listings`, {
        params: { user_id: listing.user.id, exclude: listing.id, limit: 12 },
      });
      return data.data ?? [];
    },
    staleTime: 1000 * 60 * 2,
  });

  const parentCategory = listing.category?.parent?.name_fr;
  const categoryName = listing.category?.name_fr;
  const breadcrumbCategory =
    parentCategory && categoryName
      ? `${parentCategory} › ${categoryName}`
      : categoryName || "Livres";

  const nickname =
    listing.user.profile?.nickname || `utilisateur-${listing.user.id}`;
  const sellerPath = `/${nickname}`;

  return (
    <div className="w-[90%] max-w-7xl mx-auto py-8">
      <nav className="mb-8 text-xs md:text-sm font-semibold text-gray-500 flex items-center gap-1.5 flex-wrap">
        <Link href="/" className="hover:text-[#F97316] transition-colors">
          Accueil
        </Link>
        <ChevronRight className="w-4 h-4 text-gray-400" />
        <Link href={sellerPath} className="hover:text-[#F97316] transition-colors">
          {listing.user.profile?.nickname || nickname}
        </Link>
        <ChevronRight className="w-4 h-4 text-gray-400" />
        <span className="hover:text-[#F97316] transition-colors cursor-default">
          {breadcrumbCategory}
        </span>
        {listing.level &&
          listing.level.code !== NON_APPLICABLE &&
          listing.level.name_fr && (
            <>
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <span className="hover:text-[#F97316] transition-colors cursor-default">
                {listing.level.name_fr}
              </span>
            </>
          )}
        {listing.subject &&
          listing.subject.code !== NON_APPLICABLE &&
          listing.subject.name_fr && (
            <>
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <span className="hover:text-[#F97316] transition-colors cursor-default">
                {listing.subject.name_fr}
              </span>
            </>
          )}
        <ChevronRight className="w-4 h-4 text-gray-400" />
        <span className="text-gray-900 font-bold max-w-[200px] sm:max-w-none truncate">
          {listing.title}
        </span>
      </nav>

      <ListingDetailsCard listing={listing} />

      {otherListings && otherListings.length > 0 && (
        <div className="mt-16 pt-8 border-t border-gray-100">
          <HorizontalGrid
            title={`Autres annonces de ${listing.user.profile?.nickname || listing.user.name}`}
            listings={otherListings.map(toSlimListing)}
          />
        </div>
      )}
    </div>
  );
}