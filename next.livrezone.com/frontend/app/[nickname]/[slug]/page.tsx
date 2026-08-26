import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ListingDetailFetcher from "./ListingDetailFetcher";
import { getPublicListing } from "@/lib/listings-api";
import { toJsonLd } from "@/lib/safe-json-ld";

export const dynamic = 'force-dynamic';

const SITE_URL = "https://next.livrezone.com";

interface PageProps {
  params: Promise<{
    nickname: string;
    slug: string;
  }>;
}

interface Listing {
  id: number;
  user_id: number;
  status?: string;
  published_ago?: string | null;
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

function resolveCoverUrl(listing: Listing): string | null {
  return listing.book?.cover_url || listing.cover_source_url || null;
}

function buildTitle(listing: Listing): string {
  const isbn = listing.book?.isbn_13 || listing.isbn_13;
  if (isbn) {
    return `${listing.title} (ISBN: ${isbn}) | LivreZone`;
  }
  return `${listing.title} | LivreZone`;
}

function buildDescription(listing: Listing): string {
  const base =
    listing.description && listing.description.trim()
      ? listing.description.trim()
      : `Achetez ${listing.title} sur LivreZone.`;
  return base.length > 160 ? `${base.slice(0, 157)}...` : base;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { nickname, slug } = await params;
  const match = slug.match(/^(\d+)-(.*)$/);
  if (!match) {
    return { title: "Annonce introuvable | LivreZone" };
  }

  const listing = await getPublicListing(match[1]);
  if (!listing) {
    return { title: "Annonce introuvable | LivreZone" };
  }

  const canonical = `${SITE_URL}/${nickname}/${slug}`;
  const title = buildTitle(listing);
  const description = buildDescription(listing);
  const coverUrl = resolveCoverUrl(listing);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: listing.title,
      description,
      type: "book",
      locale: "fr_MA",
      siteName: "LivreZone",
      url: canonical,
      images: coverUrl ? [{ url: coverUrl, alt: listing.title }] : [],
    },
    twitter: {
      card: coverUrl ? "summary_large_image" : "summary",
      title: listing.title,
      description,
      images: coverUrl ? [coverUrl] : [],
    },
    robots: { index: true, follow: true },
  };
}

function buildBreadcrumbJsonLd(listing: Listing, slug: string) {
  const sellerNickname =
    listing.user.profile?.nickname || `utilisateur-${listing.user_id}`;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Annonces", item: `${SITE_URL}/annonces` },
      {
        "@type": "ListItem",
        position: 3,
        name: `Bibliothèque de @${sellerNickname}`,
        item: `${SITE_URL}/${sellerNickname}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: listing.title,
        item: `${SITE_URL}/${sellerNickname}/${slug}`,
      },
    ],
  };
}

function buildBookJsonLd(listing: Listing, slug: string): Record<string, unknown> {
  const sellerNickname =
    listing.user.profile?.nickname || `utilisateur-${listing.user_id}`;
  const canonical = `${SITE_URL}/${sellerNickname}/${slug}`;
  const price = listing.discount_price ?? listing.price;
  const coverUrl = resolveCoverUrl(listing);

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: listing.title,
    description: listing.description || undefined,
    url: canonical,
    image: coverUrl ? [coverUrl] : undefined,
    inLanguage: "fr",
    isbn: listing.book?.isbn_13 || listing.isbn_13 || undefined,
    offers: {
      "@type": "Offer",
      url: canonical,
      priceCurrency: "MAD",
      price,
      itemCondition:
        listing.book_condition === "neuf"
          ? "https://schema.org/NewCondition"
          : "https://schema.org/UsedCondition",
      availability: "https://schema.org/InStock",
      seller: {
        "@type": "Person",
        name: listing.user.profile?.nickname || listing.user.name,
      },
    },
  };

  if (listing.book?.authors && listing.book.authors.length > 0) {
    jsonLd.author = listing.book.authors.map((author) => ({
      "@type": "Person",
      name: author,
    }));
  }
  if (listing.book?.publisher) {
    jsonLd.publisher = { "@type": "Organization", name: listing.book.publisher };
  }
  if (listing.book?.publication_date) {
    jsonLd.datePublished = listing.book.publication_date;
  }
  if (listing.book?.page_count) {
    jsonLd.numberOfPages = listing.book.page_count;
  }

  return jsonLd;
}

export default async function ListingPage({ params }: PageProps) {
  const { slug } = await params;

  const match = slug.match(/^(\d+)-(.*)$/);
  if (!match) return notFound();

  const listing = await getPublicListing(match[1]);
  if (!listing) return notFound();

  return (
    <>
      <ListingDetailFetcher id={match[1]} initialListing={listing} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: toJsonLd(buildBreadcrumbJsonLd(listing, slug)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: toJsonLd(buildBookJsonLd(listing, slug)),
        }}
      />
    </>
  );
}