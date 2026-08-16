import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import FilterSidebar from "@/components/FilterSidebar";
import ListingsSearch from "@/components/ListingsSearch";
import SellerContact from "@/components/SellerContact";
import SellerRating from "@/components/SellerRating";
import {
  getPublicListings,
  getPublicProfile,
  getReferenceData,
} from "@/lib/listings-api";
import { parseFilters, type AnnoncesFilters } from "@/lib/listings-filters";

export const revalidate = 60;

const SITE_URL = "https://next.livrezone.com";
const PRICE_MIN_LIMIT = 0;
const PRICE_MAX_LIMIT = 500;

type SearchParams = Record<string, string | string[] | undefined>;

interface PageProps {
  params: Promise<{ nickname: string }>;
  searchParams: Promise<SearchParams>;
}

function paramGetter(searchParams: SearchParams) {
  return (key: string): string | null => {
    const value = searchParams[key];
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  };
}

function buildCanonical(nickname: string): string {
  return `${SITE_URL}/${nickname}`;
}

function buildTitle(nickname: string): string {
  return `Bibliothèque de @${nickname} | LivreZone`;
}

function buildDescription(profile: { nickname: string }, total: number): string {
  const count = `${total} ${total > 1 ? "annonces" : "annonce"}`;
  return `Découvrez la bibliothèque de ${profile.nickname} sur LivreZone : ${count} de livres neufs et d'occasion. Contactez directement le vendeur et négociez les prix.`;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { nickname } = await params;
  const profile = await getPublicProfile(nickname);
  if (!profile) return { title: "Bibliothèque introuvable | LivreZone" };
  const title = buildTitle(profile.nickname);
  const description = buildDescription(profile, profile.publication_count);
  const canonical = buildCanonical(profile.nickname);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: "profile",
      siteName: "LivreZone",
      url: canonical,
    },
    robots: { index: true, follow: true },
  };
}

function buildBreadcrumbJsonLd(nickname: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE_URL}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: `Bibliothèque de @${nickname}`,
        item: `${SITE_URL}/${nickname}`,
      },
    ],
  };
}

function resolveLogo(logo?: string | null): string | null {
  if (!logo) return null;
  if (/^https?:\/\//.test(logo)) return logo;
  const base = (process.env.NEXT_PUBLIC_API_URL || "https://api-next.livrezone.com").replace(/\/api\/?$/, "");
  return `${base}${logo}`;
}

export default async function LibraryProfilePage({ params, searchParams }: PageProps) {
  const { nickname } = await params;
  const sp = await searchParams;
  const f: AnnoncesFilters = parseFilters(paramGetter(sp));

  const profile = await getPublicProfile(nickname);
  if (!profile) return notFound();

  const userId = profile.user_id;

  const [{ cities }, result] = await Promise.all([
    getReferenceData(),
    getPublicListings({
      userId,
      search: f.search || undefined,
      category: f.categories.length ? f.categories.join(",") : undefined,
      level: f.levels.length ? f.levels.join(",") : undefined,
      language: f.languages.length ? f.languages.join(",") : undefined,
      condition: f.conditions.length ? f.conditions.join(",") : undefined,
      cities: f.cities.length ? f.cities.join(",") : undefined,
      minPrice: f.minPrice ?? undefined,
      maxPrice: f.maxPrice ?? undefined,
      sort: f.sort || undefined,
      page: f.page,
      limit: 12,
    }),
  ]);

  const priceMinLimit =
    result.ok && result.priceMin !== undefined
      ? Math.floor(result.priceMin)
      : PRICE_MIN_LIMIT;
  const priceMaxLimit =
    result.ok && result.priceMax !== undefined
      ? Math.ceil(result.priceMax)
      : PRICE_MAX_LIMIT;

  const total = result.ok ? result.total : profile.publication_count;
  const articleCount = `${total} ${total > 1 ? "articles" : "article"}`;
  const logo = resolveLogo(profile.logo);
  const isPro = profile.profile_type === "librairie" || profile.profile_type === "professional";

  return (
    <div className="w-[90%] max-w-7xl mx-auto py-8">
      {/* Breadcrumb */}
      <nav
        aria-label="Fil d'Ariane"
        className="mb-8 text-xs md:text-sm font-semibold text-gray-500 flex items-center gap-2 flex-wrap tracking-wide uppercase"
      >
        <Link href="/" className="hover:text-black transition-colors">
          Accueil
        </Link>
        <span>/</span>
        <span className="text-black font-semibold">
          Bibliothèque de @{profile.nickname}
        </span>
      </nav>

      {/* En-tête vendeur */}
      <header className="flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start bg-slate-50 p-6 sm:p-8 rounded-2xl border border-slate-100 mb-8">
        <div className="flex-shrink-0 relative">
          {logo ? (
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-white shadow-sm">
              <Image
                src={logo}
                alt={`Logo ${profile.nickname}`}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white flex items-center justify-center text-4xl text-slate-400 font-bold uppercase border-2 border-white shadow-sm">
              {profile.nickname.charAt(0)}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center md:items-start text-center md:text-left flex-grow">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 flex flex-wrap items-center justify-center md:justify-start gap-2 mb-1">
            {profile.nickname}
            {isPro && (
              <span className="bg-[#F97316]/10 text-[#F97316] text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                Pro
              </span>
            )}
          </h1>
          <p className="text-sm font-medium text-gray-500 mb-4">
            @ {profile.nickname}
          </p>
          <div className="flex flex-wrap justify-center md:justify-start items-center gap-2">
            {profile.city?.name && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-100 text-xs font-semibold text-gray-600">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                {profile.city.name}
              </span>
            )}
            {profile.adresse && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-100 text-xs font-semibold text-gray-600">
                {profile.adresse}
              </span>
            )}
            <SellerContact
              phone={profile.phone}
              userId={profile.user_id}
            />
          </div>
        </div>

        {/* Statistiques */}
        <div className="flex gap-4 md:gap-6 justify-center md:justify-end mt-4 md:mt-0 items-start min-w-max">
          <div className="bg-white rounded-xl border border-gray-100 px-5 py-4 flex flex-col items-center justify-center min-w-[100px]">
            <div className="text-2xl font-black text-gray-900">
              {profile.publication_count}
            </div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">
              Annonces
            </div>
          </div>
          <SellerRating
            nickname={profile.nickname}
            sellerUserId={profile.user_id}
            ratingAverage={profile.rating_average}
            ratingCount={profile.rating_count}
          />
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
        {/* Sidebar filtres */}
        <Suspense
          fallback={
            <aside className="lg:w-[240px] lg:flex-shrink-0 hidden lg:block">
              <div className="animate-pulse h-96 bg-gray-100 rounded-xl" />
            </aside>
          }
        >
          <FilterSidebar
            priceMinLimit={priceMinLimit}
            priceMaxLimit={priceMaxLimit}
            cities={cities}
            showCity={false}
          />
        </Suspense>

        {/* Contenu principal */}
        <main className="flex-1 min-w-0">
          <div className="flex flex-col md:flex-row md:items-end justify-between pb-6 mb-6 border-b border-gray-100">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-black mb-1">
                Annonces ({total})
              </h2>
              {articleCount && (
                <p className="text-[13px] text-gray-500 font-medium">
                  {articleCount}
                </p>
              )}
            </div>
          </div>

          <Suspense
            fallback={
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6D28D9]"></div>
              </div>
            }
          >
            <ListingsSearch
              userId={userId}
              initialListings={result.ok ? result.data : undefined}
              initialTotal={result.ok ? result.total : undefined}
              initialLastPage={result.ok ? result.lastPage : undefined}
            />
          </Suspense>
        </main>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildBreadcrumbJsonLd(profile.nickname)),
        }}
      />
    </div>
  );
}