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
};

export default nextConfig;
