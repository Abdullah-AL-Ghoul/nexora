import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
    // Demo images are immutable; keep optimized variants cached for 30 days
    // so the slow first fetch from the remote host happens once per deploy.
    minimumCacheTTL: 30 * 24 * 60 * 60,
  },
};

export default nextConfig;
