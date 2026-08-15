import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import fs from "fs";
import path from "path";
import {
  BookOpen,
  Store,
  MapPin,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import HorizontalGrid from "@/components/HorizontalGrid";
import LivreZoneHero, { type HeroListing } from "@/components/home/LivreZoneHero";
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

    const params = new URLSearchParams({ limit: "12" });
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
  title: "LivreZone — Acheter et vendre des livres d'occasion au Maroc",
  description:
    "LivreZone, le carrefour des librairies marocaines. Retrouvez des livres neufs et d'occasion, proposés par des librairies et des particuliers, partout au Maroc.",
  openGraph: {
    title: "LivreZone — Livres neufs et d'occasion au Maroc",
    description:
      "Le carrefour des librairies marocaines : un large choix de livres proposés par des librairies et des particuliers.",
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
  { title: "Nouveautés", categories: [], viewAllUrl: "/annonces" },
  { title: "Scolaire", categories: ["SCOLAIRE"], viewAllUrl: "/annonces?category=SCOLAIRE" },
  { title: "Romans", categories: ["ROMANS"], viewAllUrl: "/annonces?category=ROMANS" },
  { title: "Mangas & BD", categories: ["MANGAS", "BD"], viewAllUrl: "/annonces?category=LITTERATURE" },
  { title: "Jeunesse", categories: ["JEUNESSE"], viewAllUrl: "/annonces?category=JEUNESSE" },
  { title: "Universitaire & Professionnel", categories: ["UNIVERSITAIRE"], viewAllUrl: "/annonces?category=UNIVERSITAIRE" },
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
  const coverUrl =
    listing.book?.cover_url ||
    (listing.cover_path
      ? `https://api-next.livrezone.com/storage/${listing.cover_path}`
      : null) ||
    listing.cover_source_url ||
    null;

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
    text: "Retrouvez des livres neufs et d'occasion, proposés par des librairies et des particuliers.",
  },
  {
    icon: Store,
    title: "Le carrefour des librairies",
    text: "Explorez les catalogues de plusieurs librairies marocaines depuis une seule plateforme.",
  },
  {
    icon: RefreshCw,
    title: "Une seconde vie pour chaque livre",
    text: "Vendez les livres que vous ne lisez plus et faites-les découvrir à de nouveaux lecteurs.",
  },
  {
    icon: MapPin,
    title: "La lecture accessible partout au Maroc",
    text: "Recherchez facilement vos livres et trouvez les offres qui vous correspondent, où que vous soyez.",
  },
];

export default async function Home() {
  const gridData = await Promise.all(gridSections.map((g) => getGridListings(g.categories)));
  // Hero : 2 livres de chaque rubrique (max 14)
  const heroListings: HeroListing[] = gridData
    .flatMap((listings) => listings.slice(0, 2))
    .map(toHeroListing)
    .slice(0, 14);
  const heroMessages = loadHeroMessages();

  const renderGrid = (i: number) => (
    <HorizontalGrid
      key={gridSections[i].title}
      title={gridSections[i].title}
      listings={gridData[i]}
      viewAllUrl={gridSections[i].viewAllUrl}
    />
  );

  return (
    <div className="flex flex-col">
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
        {renderGrid(0)}
        {renderGrid(1)}

        {/* ===== BANNIÈRE ===== */}
        <section className="my-8 w-full rounded-2xl bg-gradient-to-r from-[#F97316] to-[#ea6a0c] text-white overflow-hidden">
          <div className="w-full max-w-7xl mx-auto px-6 py-8 md:py-10 flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex items-center gap-4 text-center md:text-left">
              <RefreshCw className="w-10 h-10 md:w-12 md:h-12 flex-shrink-0" />
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold leading-tight">
                  Donnez une seconde vie à vos livres
                </h2>
                <p className="text-white/90 text-sm md:text-base mt-1">
                  Vendez en quelques minutes les livres que vous ne lisez plus.
                </p>
              </div>
            </div>
            <Link
              href="/listing/create"
              className="flex items-center gap-2 bg-white text-[#ea6a0c] font-bold text-sm md:text-base px-6 py-3 rounded-full hover:bg-gray-50 transition-colors flex-shrink-0"
            >
              Vendre un livre
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* ===== 3 grilles (Romans, Mangas & BD, Jeunesse) ===== */}
        {renderGrid(2)}
        {renderGrid(3)}
        {renderGrid(4)}

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
        {renderGrid(5)}
        {renderGrid(6)}
      </div>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}
