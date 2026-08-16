import type { MetadataRoute } from "next";
import {
  getPublicListings,
  buildListingPath,
} from "@/lib/listings-api";

const SITE_URL = "https://next.livrezone.com";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
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

  const seen = new Set<number>();
  const seenUrls = new Set<string>();

  for (let page = 1; page <= 5; page++) {
    const result = await getPublicListings({ page, limit: 100, sort: "latest" });
    if (!result.ok || result.data.length === 0) break;

    for (const listing of result.data) {
      if (seen.has(listing.id)) continue;
      seen.add(listing.id);

      const path = buildListingPath(listing);
      const url = `${SITE_URL}${path}`;
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);

      entries.push({
        url,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }

    if (page >= result.lastPage) break;
  }

  return entries;
}