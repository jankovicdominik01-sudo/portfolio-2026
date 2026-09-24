import type { Viewport } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin", "latin-ext"], display: "swap" });

export const viewport: Viewport = { themeColor: "#050505", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sk">
      <body className={`${inter.className} bg-[#050505] text-white antialiased`}>{children}</body>
    </html>
  );
}
