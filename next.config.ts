import type { NextConfig } from "next";
import { randomBytes } from "node:crypto";

const nextConfig: NextConfig = {
  env: {
    // Lead Engine (/leady): podpisový kľúč session vzniká pri builde — nie je v repozitári.
    SESSION_SECRET: process.env.SESSION_SECRET || randomBytes(32).toString("hex"),
    // Kým nie je pripojené Blob úložisko, beží Lead Engine v testovacom režime (s upozornením).
    LEADY_ALLOW_EPHEMERAL: "1",
  },
  async headers() {
    return [
      {
        // Interný Lead Engine — neindexovať, nevkladať do iframe.
        source: "/leady/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
