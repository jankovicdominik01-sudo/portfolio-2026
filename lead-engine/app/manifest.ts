import type { MetadataRoute } from "next";

/** Lead Engine ako aplikácia na ploche (Android aj iPhone). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DJWeby Lead Engine",
    short_name: "Leady",
    description: "Fronta hovorov, karta firmy a zápis výsledku.",
    id: "/leady",
    start_url: "/leady",
    scope: "/leady",
    display: "standalone",
    orientation: "portrait",
    background_color: "#050505",
    theme_color: "#050505",
    lang: "sk",
    icons: [
      { src: "/leady-192.png", sizes: "192x192", type: "image/png" },
      { src: "/leady-512.png", sizes: "512x512", type: "image/png" },
      { src: "/leady-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
