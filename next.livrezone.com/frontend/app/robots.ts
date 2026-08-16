import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/profile",
          "/profile/complete",
          "/annonces/create",
          "/annonces/*/edit",
          "/login",
        ],
      },
    ],
    sitemap: "https://next.livrezone.com/sitemap.xml",
    host: "next.livrezone.com",
  };
}