import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import fs from "fs";
import path from "path";
import dynamic from "next/dynamic";
import {
  BookOpen,
  Store,
  MapPin,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import LivreZoneHero, { type HeroListing } from "@/components/home/LivreZoneHero";

const HorizontalGrid = dynamic(() => import("@/components/HorizontalGrid"));
import type { HeroMessage } from "@/components/home/types";
import { isValidMessage, validateHref } from "@/components/home/types";

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

    const params = new URLSearchParams({ limit: "12", compact: "1" });
    if (category) params.set("category", category);

    const res = await fetch(`${baseUrl}/api/listings?${params.toString()}`, {
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

// Récupère les listings d'une ou plusieurs catégories (fusionnées, sans doublons)
async function getGridListings(categories: string[] = []): Promise<Listing[]> {
  if (categories.length === 0) return getListings();
  const results = await Promise.all(categories.map((c) => getListings(c)));
  const seen = new Map<number, Listing>();
  results.flat().forEach((l) => {
    if (l && l.id && !seen.has(l.id)) seen.set(l.id, l);
  });
  return Array.from(seen.values());
}

export type SlimListing = {
  id: number;
  title: string;
  price: number;
  discount_price: number | null;
  book_condition: string;
  authors: string | null;
  coverUrl: string | null;
  url: string;
  city: string | null;
};

// Réduit la taille de l'objet pour le RSC Payload et gère le thumbnail 320
function toSlimListing(listing: Listing): SlimListing {
  const authors = listing.book?.authors
    ? (Array.isArray(listing.book.authors) ? listing.book.authors.join(", ") : listing.book.authors)
    : null;

  let coverUrl = listing.book?.cover_url 
    || (listing.cover_path ? `https://api-next.livrezone.com/storage/${listing.cover_path}` : null)
    || listing.cover_source_url 
    || null;

  // Utiliser la vignette 320px pour les grilles
  if (coverUrl && coverUrl.includes("/book-cover-proxy/") && !coverUrl.includes("/thumbnails/")) {
    coverUrl = coverUrl.replace("/book-cover-proxy/", "/book-cover-proxy/thumbnails/320/");
  }

  const nickname = listing.user?.profile?.nickname || `utilisateur-${listing.user_id || ""}`;
  const isbn = listing.isbn_13 || listing.book?.isbn_13 || "livre";
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
    city: listing.user?.profile?.city?.name || null,
  };
}

// Charge et valide les messages du hero (SSR). Retourne 3 messages maximum sans doublon.
function loadHeroMessages(): HeroMessage[] {
  const fallback: HeroMessage = {
    id: 0,
    language: "fr",
    direction: "ltr",
    title: "Nouveautés",
    description: "Les dernières publications proposées par les librairies et les particuliers partout au Maroc.",
    primaryAction: { label: "Découvrir les livres", href: "/annonces" },
  };

  try {
    const filePath = path.join(process.cwd(), "data", "hero-messages.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [fallback];

    const valid = parsed.filter(isValidMessage).map((m) => ({
      ...m,
      primaryAction: {
        ...m.primaryAction,
        href: validateHref(m.primaryAction.href),
      },
      secondaryAction: m.secondaryAction
        ? { ...m.secondaryAction, href: validateHref(m.secondaryAction.href) }
        : undefined,
    }));

    if (valid.length === 0) return [fallback];

    // Sélection aléatoire de 3 messages sans doublon
    const shuffled = valid.sort(() => Math.random() - 0.5);
    const count = Math.min(3, shuffled.length);
    return shuffled.slice(0, count);
  } catch {
    return [fallback];
  }
}

export const metadata: Metadata = {
  title: "LivreZone | Marketplace de livres neufs et d'occasion au Maroc",
  description:
    "Découvrez sur LivreZone des annonces de livres neufs et d'occasion proposées par des librairies et des particuliers. Trouvez ou vendez vos livres partout au Maroc.",
  openGraph: {
    title: "LivreZone | Marketplace de livres neufs et d'occasion au Maroc",
    description:
      "Découvrez sur LivreZone des annonces de livres neufs et d'occasion proposées par des librairies et des particuliers. Trouvez ou vendez vos livres partout au Maroc.",
    type: "website",
    locale: "fr_MA",
    siteName: "LivreZone",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "LivreZone",
  url: "https://next.livrezone.com",
  description:
    "Le carrefour des librairies marocaines. Retrouvez des livres neufs et d'occasion proposés par des librairies et des particuliers.",
  inLanguage: "fr",
};

const gridSections = [
  { title: "Livres récemment ajoutés", categories: [], viewAllUrl: "/annonces" },
  { title: "Livres scolaires neufs et d'occasion", categories: ["SCOLAIRE"], viewAllUrl: "/annonces?category=SCOLAIRE" },
  { title: "Romans et littérature", categories: ["ROMANS"], viewAllUrl: "/annonces?category=ROMANS" },
  { title: "Mangas et bandes dessinées", categories: ["MANGAS", "BD"], viewAllUrl: "/annonces?category=LITTERATURE" },
  { title: "Livres pour enfants et jeunesse", categories: ["JEUNESSE"], viewAllUrl: "/annonces?category=JEUNESSE" },
  { title: "Livres universitaires et professionnels", categories: ["UNIVERSITAIRE"], viewAllUrl: "/annonces?category=UNIVERSITAIRE" },
  { title: "Religion", categories: ["RELIGION"], viewAllUrl: "/annonces?category=RELIGION" },
];

const heroCategories = [
  { name: "Scolaire", href: "/annonces?category=SCOLAIRE" },
  { name: "Romans", href: "/annonces?category=ROMANS" },
  { name: "Mangas & BD", href: "/annonces?category=LITTERATURE" },
  { name: "Jeunesse", href: "/annonces?category=JEUNESSE" },
  { name: "Religion", href: "/annonces?category=RELIGION" },
];

const slugify = (text: string) => {
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
};

// Convertit un listing en entrée du mur de couvertures du hero
function toHeroListing(listing: Listing): HeroListing {
  let coverUrl =
    listing.book?.cover_url ||
    (listing.cover_path
      ? `https://api-next.livrezone.com/storage/${listing.cover_path}`
      : null) ||
    listing.cover_source_url ||
    null;

  if (coverUrl && coverUrl.includes("/book-cover-proxy/") && !coverUrl.includes("/thumbnails/")) {
    coverUrl = coverUrl.replace("/book-cover-proxy/", "/book-cover-proxy/thumbnails/320/");
  }

  const nickname =
    listing.user?.profile?.nickname || `utilisateur-${listing.user_id || ""}`;
  const isbn = listing.isbn_13 || listing.book?.isbn_13 || "livre";
  const titleSlug = slugify(listing.title);
  const href = `/${nickname}/${listing.id}-${isbn}-${titleSlug}`;

  return {
    id: listing.id,
    title: listing.title,
    coverUrl,
    href,
  };
}

const whyPoints = [
  {
    icon: BookOpen,
    title: "Un large choix de livres",
    text: "Découvrez des livres neufs et d'occasion dans de nombreuses catégories.",
  },
  {
    icon: Store,
    title: "Librairies et particuliers réunis",
    text: "Explorez depuis une seule plateforme les annonces proposées par des librairies et des particuliers.",
  },
  {
    icon: RefreshCw,
    title: "Une seconde vie pour vos livres",
    text: "Trouvez de nouveaux lecteurs pour les livres que vous ne lisez plus.",
  },
  {
    icon: MapPin,
    title: "Des annonces partout au Maroc",
    text: "Recherchez des livres disponibles dans différentes villes et régions du Royaume.",
  },
];

const GridSkeleton = () => (
  <section className="w-full py-8 border-t border-gray-100 first-of-type:border-t-0 first-of-type:mt-0">
    <div className="flex items-center justify-between mb-6">
      <div className="h-6 bg-gray-200 rounded w-1/3 animate-pulse"></div>
      <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
    </div>
    <div className="flex overflow-hidden gap-5">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex-shrink-0 w-[45%] sm:w-[30%] md:w-[22%] lg:w-[calc(20%-16px)]">
          <div className="w-full pb-[140%] bg-gray-200 rounded-md animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 mt-3 animate-pulse"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2 mt-2 animate-pulse"></div>
        </div>
      ))}
    </div>
  </section>
);

async function SuspendedGrid({ section }: { section: typeof gridSections[0] }) {
  const listings = await getGridListings(section.categories);
  if (!listings || listings.length === 0) return null;
  const slimListings = listings.map(toSlimListing);
  return (
    <HorizontalGrid
      title={section.title}
      listings={slimListings}
      viewAllUrl={section.viewAllUrl}
    />
  );
}

export default async function Home() {
  // Fetch only hero listings (latest overall) to unblock the initial render quickly
  const heroData = await getListings();
  const heroListings: HeroListing[] = heroData.map(toHeroListing).slice(0, 15);
  const heroMessages = loadHeroMessages();

  return (
    <div className="flex flex-col">
      {/* ===== H1 UNIQUE (visible, pleine largeur) ===== */}
      <h1 className="w-full bg-[#1a0a40] text-white text-center text-xl md:text-2xl font-bold py-4 px-4">
        La marketplace marocaine des livres neufs et d'occasion
      </h1>

      {/* ===== HERO ===== */}
      <LivreZoneHero
        messages={heroMessages}
        listings={heroListings}
      />

      {/* ===== Catégories rapides ===== */}
      <nav
        className="w-[90%] max-w-7xl mx-auto py-5 flex flex-wrap justify-center gap-2"
        aria-label="Catégories populaires"
      >
        {heroCategories.map((cat) => (
          <Link
            key={cat.name}
            href={cat.href}
            className="text-xs md:text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-[#6D28D9] hover:text-white rounded-full px-4 py-1.5 transition-colors"
          >
            {cat.name}
          </Link>
        ))}
      </nav>

      {/* ===== HERO → 2 grilles (Nouveautés, Scolaire) ===== */}
      <div className="w-[90%] max-w-7xl mx-auto py-10 flex flex-col">
        <React.Suspense fallback={<GridSkeleton />}>
          <SuspendedGrid section={gridSections[0]} />
        </React.Suspense>
        <React.Suspense fallback={<GridSkeleton />}>
          <SuspendedGrid section={gridSections[1]} />
        </React.Suspense>

        {/* ===== BANNIÈRE ===== */}
        <section className="my-8 w-full rounded-2xl bg-gradient-to-r from-[#F97316] to-[#ea6a0c] text-white overflow-hidden">
          <div className="w-full max-w-7xl mx-auto px-6 py-8 md:py-10 flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex items-center gap-4 text-center md:text-left">
              <RefreshCw className="w-10 h-10 md:w-12 md:h-12 flex-shrink-0" />
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold leading-tight">
                  Trouvez un acheteur pour les livres que vous ne lisez plus et
                  permettez à de nouveaux lecteurs de les découvrir.
                </h2>
                <p className="text-white/90 text-sm md:text-base mt-1">
                  Mettez en vente vos livres sur LivreZone en quelques minutes.
                </p>
              </div>
            </div>
            <Link
              href="/annonces/create"
              className="flex items-center gap-2 bg-white text-[#ea6a0c] font-bold text-sm md:text-base px-6 py-3 rounded-full hover:bg-gray-50 transition-colors flex-shrink-0"
            >
              Vendre un livre
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* ===== 3 grilles (Romans, Mangas & BD, Jeunesse) ===== */}
        <React.Suspense fallback={<GridSkeleton />}>
          <SuspendedGrid section={gridSections[2]} />
        </React.Suspense>
        <React.Suspense fallback={<GridSkeleton />}>
          <SuspendedGrid section={gridSections[3]} />
        </React.Suspense>
        <React.Suspense fallback={<GridSkeleton />}>
          <SuspendedGrid section={gridSections[4]} />
        </React.Suspense>

        {/* ===== POURQUOI LIVREZONE ===== */}
        <section className="w-full py-10">
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight text-center mb-8">
            Pourquoi choisir LivreZone ?
          </h2>
          {/* Mobile : scroll horizontal / Desktop : grille */}
          <div className="flex gap-5 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-4 lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0 lg:snap-none"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {whyPoints.map((point) => (
              <div
                key={point.title}
                className="snap-start flex-shrink-0 w-[80%] sm:w-[45%] lg:w-auto bg-white border border-gray-100 rounded-2xl p-6 flex flex-col items-start gap-3 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 rounded-xl bg-[#6D28D9]/10 text-[#6D28D9] flex items-center justify-center">
                  <point.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">{point.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{point.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ===== 2 grilles (Universitaire & Professionnel, Religion) ===== */}
        <React.Suspense fallback={<GridSkeleton />}>
          <SuspendedGrid section={gridSections[5]} />
        </React.Suspense>
        <React.Suspense fallback={<GridSkeleton />}>
          <SuspendedGrid section={gridSections[6]} />
        </React.Suspense>
      </div>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}
