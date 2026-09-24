import type { NextConfig } from "next";
import { randomBytes } from "node:crypto";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: {
    // Podpisový kľúč session vznikne pri každom builde (nie je v kóde ani v repozitári).
    SESSION_SECRET: process.env.SESSION_SECRET || randomBytes(32).toString("hex"),
    LEADY_ALLOW_EPHEMERAL: "1",
  },
  async headers() {
    return [
      {
        source: "/:path*",
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
