import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { listingSlug } from "@/lib/book-slug";
import ListingDetailFetcher from "./ListingDetailFetcher";
import { getPublicListing, resolveListingCover } from "@/lib/listings-api";
import { toJsonLd } from "@/lib/safe-json-ld";

export const dynamic = 'force-dynamic';

import { SITE_URL } from "@/lib/site-url";

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
  cover_url?: string | null;
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
  // Même chaîne que ListingDetailsCard (lib/listings-api) : couverture
  // catalogue réelle (cover_path présent) > upload user (URL ou
  // cover_path → /storage) > fallbacks (catalogue externe, source externe).
  // Utilisée pour l'image OpenGraph.
  return resolveListingCover(listing);
}

function buildTitle(listing: Listing): string {
  const isbn = listing.book?.isbn_13 || listing.isbn_13;
  // Le template de title du layout ajoute « | LivreZone » — ne pas le doubler.
  if (isbn) {
    return `${listing.title} (ISBN: ${isbn})`;
  }
  return listing.title;
}

function buildDescription(listing: Listing): string {
  const base =
    listing.description && listing.description.trim()
      ? listing.description.trim()
      : `Achetez ${listing.title} sur LivreZone.`;
  return base.length > 160 ? `${base.slice(0, 157)}...` : base;
}

/** Prix affiché (discount si applicable) en MAD, pour og:title. */
function displayPrice(listing: Listing): number {
  const original = Number(listing.price);
  const discounted = Number(listing.discount_price);
  const hasDiscount =
    listing.discount_price != null &&
    Number.isFinite(discounted) &&
    discounted < original;
  return hasDiscount ? discounted : original;
}

function formatPrice(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/**
 * Texte NATIF de la carte Facebook (og:title / og:description) — c'est là que
 * le titre, l'ISBN et l'état sont lisibles désormais : l'image OG (template
 * v4) ne porte plus que couverture + marque + prix, le texte rasterisé fin
 * étant illisible après la réduction + recompression de Facebook.
 */
function buildSocialTitle(listing: Listing): string {
  return `${listing.title} — ${formatPrice(displayPrice(listing))} MAD`;
}

function buildSocialDescription(listing: Listing): string {
  const label =
    listing.book_condition === "neuf"
      ? "Neuf"
      : listing.book_condition === "occas"
        ? "Occasion"
        : null;
  const isbn = listing.book?.isbn_13 || listing.isbn_13;
  const parts = [
    label,
    isbn ? `ISBN ${isbn}` : null,
    listing.user?.profile?.nickname ? `Vendu par @${listing.user.profile.nickname}` : null,
  ].filter(Boolean);
  const base = `${parts.join(" · ")}${parts.length ? " — " : ""}${buildDescription(listing)}`;
  return base.length > 200 ? `${base.slice(0, 197)}...` : base;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { nickname, slug } = await params;
  const match = slug.match(/^(\d+)-(.*)$/);
  if (!match) {
    return { title: "Annonce introuvable" };
  }

  const listing = await getPublicListing(match[1]);
  if (!listing) {
    return { title: "Annonce introuvable" };
  }

  // Canonical depuis les données (SEO 06/09) — même format que le lien Telegram
  // admin (id-isbn-titre). Les variantes de slug sont 308 vers ce canonical.
  const canonicalSlug = listingSlug(listing);
  const canonical = `${SITE_URL}/${nickname}/${canonicalSlug}`;
  const title = buildTitle(listing);
  const description = buildDescription(listing);
  // Image OG : template visuelle (couverture entière + marque + prix) rendue
  // et mise en cache par /api/og/listing/<id> — le texte (titre/ISBN/état)
  // est porté par og:title/og:description, natif et net. Ne pas pointer
  // directement sur la couverture brute : Facebook la recadre.
  const socialImage = `${SITE_URL}/api/og/listing/${listing.id}`;
  const socialTitle = buildSocialTitle(listing);
  const socialDescription = buildSocialDescription(listing);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: socialTitle,
      description: socialDescription,
      type: "book",
      locale: "fr_MA",
      siteName: "LivreZone",
      url: canonical,
      images: [
        { url: socialImage, width: 1200, height: 630, alt: `${listing.title} — LivreZone` },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: socialDescription,
      images: [socialImage],
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
  const { nickname, slug } = await params;

  const match = slug.match(/^(\d+)-(.*)$/);
  if (!match) return notFound();

  const listing = await getPublicListing(match[1]);
  if (!listing) return notFound();

  // Normalisation du slug (SEO 06/09) : variantes 308 vers le canonique.
  const canonicalSlug = listingSlug(listing);
  if (slug !== canonicalSlug) {
    permanentRedirect(`/${nickname}/${canonicalSlug}`);
  }

  return (
    <>
      <ListingDetailFetcher id={match[1]} initialListing={listing} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: toJsonLd(buildBreadcrumbJsonLd(listing, canonicalSlug)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: toJsonLd(buildBookJsonLd(listing, canonicalSlug)),
        }}
      />
    </>
  );
}