import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Erasmus+ prezentácia (public/erasmus) pod krátkym odkazom djweby.sk/erasmus
  async redirects() {
    return [
      {
        source: "/erasmus",
        destination: "/erasmus/index.html",
        permanent: false,
      },
    ];
  },
  // Subdoména erasmus.djweby.sk zobrazí priamo prezentáciu
  async rewrites() {
    const erasmusHost = [{ type: "host" as const, value: "erasmus.djweby.sk" }];
    return {
      beforeFiles: [
        { source: "/", has: erasmusHost, destination: "/erasmus/index.html" },
        { source: "/img/:path*", has: erasmusHost, destination: "/erasmus/img/:path*" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
