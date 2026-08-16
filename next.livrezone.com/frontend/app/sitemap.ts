import type { MetadataRoute } from "next";
import api from "@/lib/axios";

const SITE_URL = "https://next.livrezone.com";

const slugify = (text: string) => {
  if (!text) return "";
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

interface SitemapListing {
  id: number;
  title: string;
  updated_at: string;
  nickname: string;
  isbn: string;
}

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/annonces`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/livres`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];

  try {
    const { data } = await api.get("/sitemap/listings");
    const listings: SitemapListing[] = data.data || [];

    const dynamicRoutes: MetadataRoute.Sitemap = listings.map((listing) => ({
      url: `${SITE_URL}/${listing.nickname}/${listing.id}-${listing.isbn}-${slugify(listing.title)}`,
      lastModified: new Date(listing.updated_at),
      changeFrequency: "daily",
      priority: 0.7,
    }));

    return [...routes, ...dynamicRoutes];
  } catch (error) {
    console.error("Failed to fetch dynamic sitemap listings:", error);
    return routes;
  }
}