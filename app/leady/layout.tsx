import type { Metadata } from "next";
import "./leady.css";

/**
 * Interný Lead Engine na djweby.sk/leady. Vlastný vzhľad, bez kurzora
 * a navigácie verejného webu, neindexuje sa.
 */
export const metadata: Metadata = {
  title: { default: "Lead Engine · DJWeby", template: "%s · Lead Engine" },
  description: "Interný obchodný systém DJWeby.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  icons: { icon: "/leady-icon.svg" },
  alternates: { canonical: null },
  openGraph: null,
};

export default function LeadyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="leady-root min-h-dvh bg-bg text-white antialiased">{children}</div>;
}
