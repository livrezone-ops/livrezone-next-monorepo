import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api-next.livrezone.com",
      },
    ],
  },
};

export default nextConfig;
