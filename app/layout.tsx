import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// 1. IMPORT PRÉMIOVÉHO KURZORA (Uisti sa, že máš tento súbor vytvorený)
import CustomCursor from "@/components/ui/CustomCursor";

// Optimalizácia fontu (displey: swap zaručí rýchlejšie načítanie textu, will-change GPU akceleráciu)
const inter = Inter({ subsets: ["latin"], display: "swap", variable: '--font-inter' });

// 2. VIEWPORT API (Splynutie s prehliadačom na mobile - vizuálny luxus)
export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};


// 3. DOKONALÉ SEO NASTAVENIE
export const metadata: Metadata = {
  // --- ZMENIŤ PRED DEPLOYOM ---
  metadataBase: new URL("https://djweby.sk"), // Sem daj svoju reálnu doménu
  manifest: "/manifest.json",
  // ---------------------------

  title: {
    default: "Dominik Jankovič | Senior Web Developer & SEO Špecialista",
    template: "%s | Dominik Jankovič",
  },
  description: "Tvorba prémiových, bleskovo rýchlych webstránok a aplikácií na mieru. Nekupujete si šablónu, budujem nástroje, ktoré dominujú trhu. Pôsobím v Skalici a na celom Slovensku.",
  keywords: [
    "tvorba webstránok", "web developer Skalica", "tvorba eshopu", "Slovensko", 
    "Next.js developer", "React frontend", "SEO optimalizácia", "GSAP animácie", 
    "prémiový webdesign", "Dominik Jankovič"
  ],
  authors: [{ name: "Dominik Jankovič", url: "https://dominikjankovic.sk" }],
  creator: "Dominik Jankovič",
  publisher: "Dominik Jankovič",
  
  // Zakáže automatické formátovanie čísiel a mailov na iPhonoch
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },

  // Inštrukcie pre Googlebota na maximálne vyťaženie
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  alternates: {
    canonical: "/",
  },

  openGraph: {
    type: "website",
    locale: "sk_SK",
    url: "https://dominikjankovic.sk",
    title: "Dominik Jankovič | Nástroje, ktoré dominujú trhu.",
    description: "Moderné weby na mieru. Spojenie špičkového UX/UI dizajnu, bleskového výkonu a nekompromisného SEO.",
    siteName: "Dominik Jankovič - Web Development",
    images: [
      {
        url: "/og-image.jpg", // <--- UISTI SA, ŽE MÁŠ TENTO SÚBOR V ZLOŽKE public/
        width: 1200,
        height: 630,
        alt: "Dominik Jankovič - Ukážka prémiového portfólia",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dominik Jankovič | Senior Web Developer",
    description: "Prémiová tvorba webstránok a webových aplikácií na mieru. Bleskový výkon a GSAP animácie.",
    images: ["/og-image.jpg"], // Zmeň neskôr
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sk">
      {/* Pridaný overflow-x-hidden chráni pred horizontálnym scrollom na mobile. 
        selection:bg-blue-600 robí prémiové, modré označovanie textu. 
        cursor-none je kritické pre fungovanie Custom Kurzora!
      */}
      <body className={`${inter.className} bg-[#050505] text-white antialiased overflow-x-hidden selection:bg-blue-600 selection:text-white cursor-none`}>
        
        {/* 4. VLOŽENIE CUSTOM KURZORA PRE VŠETKY STRÁNKY */}
        <CustomCursor />
        
        {children}
        {/* 2. NOISE OVERLAY - PRIDANÉ TU */}
      <div className="noise-overlay" />
      </body>
    </html>
  );
}