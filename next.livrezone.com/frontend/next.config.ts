import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/livres",
        destination: "/books",
        permanent: true,
      },
      {
        source: "/livres/:path*",
        destination: "/books/:path*",
        permanent: true,
      },
      // /register n'existe pas en page dédiée : l'inscription est l'onglet
      // "register" de /login (décision propriétaire 30/08 — pas de double page).
      {
        source: "/register",
        destination: "/login?tab=register",
        permanent: false,
      },
      // /demandes/create n'existe pas : la création de demande se fait dans le
      // dashboard (formulaire avec recherche catalogue) — flow existant conservé.
      {
        source: "/demandes/create",
        destination: "/dashboard/demandes/create",
        permanent: false,
      },
    ];
  },
  images: {
    // 03/09/2026 : optimiseur Next réactivé (décision propriétaire) — le WAF
    // Caddy/Coraza autorise désormais /_next/image (règle id 100900 dans
    // next.livrezone.com.conf). minimumCacheTTL 30 j pour éviter que
    // l'optimiseur ne re-traite les mêmes couvertures.
    unoptimized: false,
    formats: ["image/webp"],
    minimumCacheTTL: 2592000,
    // api-next.livrezone.com résout vers 192.168.1.202 (LAN) : la protection
    // anti-SSRF de Next 16 refuse ce fetch sans ce flag. C'est notre propre
    // API → autorisé explicitement (fetch direct LAN, sans passer par Cloudflare).
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api-next.livrezone.com",
      },
    ],
  },
};

export default nextConfig;
