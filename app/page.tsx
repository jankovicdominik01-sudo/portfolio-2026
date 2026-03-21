"use client";

/**
 * ============================================================================
 * PORTFOLIO SYSTEM ARCHITECTURE
 * ============================================================================
 * @description Hlavný vstupný bod aplikácie. Beží na Data-Driven prístupe.
 * @architecture
 * 1. Types & Interfaces - Striktné typovanie pre bezpečnosť kódu.
 * 2. Configuration Layer - Centrálne riadenie textov, dát a cien.
 * 3. Custom Hooks - Oddelená biznis logika (Formuláre, Cookies, Routing).
 * 4. UI Components - Znovupoužiteľné prvky (Tlačidlá, Modaly).
 * 5. Page Layout - Zloženie sekcií a injekcia GSAP animácií.
 * ============================================================================
 */

import React, { useEffect, useRef, useState, useLayoutEffect, useCallback } from "react";
import Image from "next/image"; // Pridané pre maximálnu rýchlosť webu
import Lenis from "@studio-freight/lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Home, FolderOpen, Mail, Rocket, CheckCircle2, ArrowUpRight, 
  Layout, Code2, Zap, Terminal, ChevronDown, ShieldCheck, X, 
  Settings2, Loader2, Check, AlertCircle, Phone
} from "lucide-react";

// Externé UI komponenty
import { HyperText } from "@/components/ui/hyper-text";
import { AnimeNavBar } from "@/components/ui/anime-navbar";
import Footer from "@/components/ui/animated-footer";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// ============================================================================
// 1. TYPES & INTERFACES
// ============================================================================

interface ProjectSchema {
  id: number;
  title: string;
  category: string;
  problem: string;
  solution: string;
  result: string;
  image: string;
  href: string;
  isLocked?: boolean;
}

interface PricingSchema {
  id: string;
  title: string;
  price: string;
  description: string;
  features: string[];
  isPopular?: boolean;
}

interface LegalSchema {
  id: string;
  title: string;
  lastUpdated: string;
  sections: { h: string; p: string }[];
}

interface FormState {
  status: 'idle' | 'submitting' | 'success' | 'error';
  errors: Record<string, string>;
  message: string;
}

// ============================================================================
// 2. CONFIGURATION LAYER
// ============================================================================

const SITE_CONFIG = {
  name: "Dominik Jankovič",
  email: "jankovic.dominik01@gmail.com",
  phone: "+421945456973",
  displayPhone: "0945 456 973",
  role: "Senior Web Developer & SEO Špecialista",
  year: new Date().getFullYear(),
};

const NAV_ITEMS = [
  { name: "Domov", url: "#home", icon: Home },
  { name: "Služby", url: "#services", icon: Layout },
  { name: "Projekty", url: "#work", icon: FolderOpen },
  { name: "Cenník", url: "#pricing", icon: Rocket },
  { name: "Proces", url: "#process", icon: Terminal },
  { name: "Kontakt", url: "#contact", icon: Mail },
];

const PROJECTS_DATA: ProjectSchema[] = [
  { 
    id: 1, 
    title: 'Kristína Music', 
    category: 'Hudba & Umenie', 
    problem: 'Skvelá hudba si zaslúži rovnako dobrý vizuál. Pôvodný web však vôbec neodrážal jej talent a pre organizátorov bolo zbytočne zložité dohodnúť si vystúpenie.', 
    solution: 'Vytvoril som online priestor, ktorý dýcha jej osobnosťou. Stránka je vizuálne pohlcujúca a booking na eventy je teraz pre fanúšikov aj manažérov otázkou pár klikov.', 
    result: 'Nárast exkluzívnych bookingov', 
    image: '/pk.jpg', 
    href: "https://kristinamusic.sk" 
  },
  { 
    id: 2, 
    title: 'New Way Company', 
    category: 'Sebarozvoj & Ľudský prístup', 
    problem: 'Firma pomáha ľuďom hľadať novú cestu, no ich starý web pôsobil chladne a neosobne. Návštevníci z neho necítili empatiu ani potrebnú dôveru.', 
    solution: 'Zahodili sme zložité texty a vytvorili čistý, presvetlený web, z ktorého vyžaruje pokoj. Návštevník okamžite cíti, že je v správnych rukách a nebojí sa ozvať.', 
    result: '+120% nárast dopytov', 
    image: '/newway.jpg', 
    href: "https://newwaycompany.sk" 
  },
  { 
    id: 3, 
    title: 'PK Izolácie', 
    category: 'Remeslo & Stavebníctvo', 
    problem: 'Partia šikovných majstrov, ktorí robia poctivú prácu, no na internete ich vôbec nebolo vidieť. Prichádzali tak o množstvo zákaziek priamo z vlastného okolia.', 
    solution: 'Postavil som im moderný a priamočiary web. Zákazník hneď vidí reálne ukážky ich práce a dokáže si úplne jednoducho, bez stresu, vyžiadať cenovú ponuku.', 
    result: '3x viac dopytov na realizácie', 
    image: '/pkreal.jpg', 
    href: "https://pkizolacie.sk" 
  },
];

const PRICING_DATA: PricingSchema[] = [
  { id: "landing", title: "Landing Page", price: "od 600 €", description: "Perfektné pre overenie nápadu, zber leadov alebo predaj jedného produktu.", features: ["Jednostránková štruktúra", "Responzívny UX dizajn", "Kontaktný formulár", "Základné SEO nastavenie", "Rýchlosť pod 1 sekundu"] },
  { id: "business", title: "Firemný Web", price: "od 1 400 €", description: "Komplexná prezentácia firmy, ktorá buduje dôveru a automatizuje procesy.", isPopular: true, features: ["Viacstránková architektúra", "Prémiové GSAP animácie", "Pokročilé technické SEO", "Napojenie na Headless CMS", "Analytika a GDPR compliance"] },
  { id: "app", title: "Individuálne", price: "Na mieru", description: "Webové aplikácie, portály, rozsiahle e-shopy a zložité integrácie.", features: ["React / Next.js vývoj", "Návrh databázy", "Autentifikácia používateľov", "Integrácie platobných brán", "API vývoj"] }
];

const PROCESS_DATA = [
  { step: "01", title: "Spoznanie biznisu a dohoda", desc: "Najprv musím pochopiť vaše ciele a zákazníkov. Navrhneme presný plán a nacenenie. Všetko podložíme oficiálnou zmluvou o dielo, ktorú si vaša firma môže bez problémov dať do nákladov. Žiadne skryté poplatky, len čistá a férová dohoda." },
  { step: "02", title: "Dizajn a štruktúra", desc: "Vytvorím vizuálny návrh, ktorý nielen krásne vyzerá, ale hlavne predáva. Budeme ho spoločne ladiť a upravovať dovtedy, kým nebudete na 100 % presvedčení, že presne takto má vaša značka pôsobiť." },
  { step: "03", title: "Vývoj a oživenie webu", desc: "Schválený dizajn pretavím do bleskovo rýchleho kódu. Pridám jemné animácie a detaily, vďaka ktorým bude váš nový web dýchať, žiť a pôsobiť na vašich klientov naozaj prémiovo." },
  { step: "04", title: "Spustenie a preberací protokol", desc: "Pred ostrým štartom všetko poctivo otestujem. Web bezpečne spustíme do sveta a podpíšeme preberací protokol. Samozrejmosťou je bezplatné zaškolenie, aby ste s webom vedeli úplne jednoducho pracovať aj sami." }
];

const FAQ_DATA = [
  { q: "Ako dlho trvá vývoj prémiového webu?", a: "Závisí od komplexnosti. High-end landing page zvyčajne 2-3 týždne. Zložitá platforma alebo e-commerce od 6 do 10 týždňov. Vždy dostanete presný harmonogram a transparentnú komunikáciu." },
  { q: "Budem si vedieť web upravovať sám?", a: "Áno. Weby napájam na moderné Headless CMS (napr. Sanity alebo Strapi), kde si texty a fotky upravíte rovnako jednoducho ako v textovom editore, bez nutnosti písať kód." },
  { q: "Aké technológie používate?", a: "Pracujem primárne s ekosystémom React a Next.js pre maximálny výkon a bezpečnosť. Na animácie využívam priemyselný štandard GSAP. Štýlovanie riešim cez Tailwind CSS." },
];

const TECHNOLOGIES_DATA = ["React", "Next.js", "TypeScript", "GSAP", "Tailwind CSS", "Figma", "Node.js", "Vercel", "PostgreSQL"];

const LEGAL_DATA: Record<string, LegalSchema> = {
  privacy: {
    id: "privacy", title: "Ochrana osobných údajov (GDPR)", lastUpdated: "Aktuálne",
    sections: [
      { h: "1. Kto spracúva vaše údaje?", p: `Prevádzkovateľom vašich osobných údajov je ${SITE_CONFIG.name}. V prípade akýchkoľvek otázok ohľadom GDPR ma môžete kontaktovať na e-maile ${SITE_CONFIG.email}.` },
      { h: "2. Aké údaje zhromažďujem a prečo?", p: "Prostredníctvom kontaktného formulára spracúvam vaše meno, e-mailovú adresu a obsah správy. Tieto údaje sú nevyhnutné na to, aby som vám mohol odpovedať na váš dopyt a vypracovať cenovú ponuku." },
      { h: "3. Ako dlho údaje uchovávam?", p: "Pokiaľ nedôjde k uzatvoreniu zmluvy o dielo, vaše kontaktné údaje bezpečne vymažem po uplynutí 12 mesiacov od našej poslednej komunikácie." },
      { h: "4. Vaše práva", p: "V zmysle nariadenia GDPR máte právo požadovať prístup k vašim údajom, ich opravu, vymazanie alebo obmedzenie spracúvania." }
    ]
  },
  cookies: {
    id: "cookies", title: "Cookies Politika", lastUpdated: "Aktuálne",
    sections: [
      { h: "Čo sú to súbory cookies?", p: "Cookies sú malé textové súbory, ktoré webová stránka ukladá do vášho zariadenia. Pomáhajú mi zabezpečiť základnú funkcionalitu webu a porozumieť tomu, ako ho návštevníci používajú." },
      { h: "Nevyhnutné cookies (Vždy aktívne)", p: "Tieto cookies sú technicky nevyhnutné pre správne fungovanie stránky (napríklad si pamätajú vaše preferencie ochrany súkromia a nastavenie cookie bannera). Neda sa ich vypnúť." },
      { h: "Analytické cookies (Voliteľné)", p: "Používam anonymizované analytické nástroje (bez ukladania vašej IP adresy v surovom stave) na meranie návštevnosti a vylepšovanie používateľského zážitku. Tieto cookies sú spustené len s vaším súhlasom." }
    ]
  },
  terms: {
    id: "terms", title: "Podmienky používania (VOP)", lastUpdated: "Aktuálne",
    sections: [
      { h: "1. Úvodné ustanovenia", p: `Tieto podmienky upravujú používanie webovej stránky na doméne, ktorej vlastníkom je ${SITE_CONFIG.name}. Používaním tohto webu súhlasíte s týmito podmienkami.` },
      { h: "2. Autorské práva", p: "Všetok obsah na this stránke, vrátane zdrojového kódu, textov, dizajnu a architektonických riešení, je mojím duševným vlastníctvom. Akékoľvek kopírovanie bez predchádzajúceho písomného súhlasu je zakázané." },
      { h: "3. Obmedzenie zodpovednosti", p: "Odoslanie kontaktného formulára nezakladá automaticky zmluvný vzťah. Nezodpovedám za prípadné škody vzniknuté nemožnosťou využívať túto webovú stránku." }
    ]
  }
};

// ============================================================================
// 3. CUSTOM HOOKS (S funkčným odosielaním mailov cez Web3Forms)
// ============================================================================

const useSmoothScroll = () => {
  return useCallback((e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement, MouseEvent>, targetId: string) => {
    e.preventDefault();
    const target = document.querySelector(targetId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
      window.history.pushState(null, '', targetId);
    }
  }, []);
};

const useContactForm = () => {
  const [formState, setFormState] = useState<FormState>({ status: 'idle', errors: {}, message: '' });

  const validate = (data: FormData) => {
    const errors: Record<string, string> = {};
    const email = data.get('email') as string;
    const name = data.get('name') as string;
    const message = data.get('message') as string;

    if (!name || name.trim().length < 2) errors.name = "Meno musí obsahovať aspoň 2 znaky.";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Zadajte platnú e-mailovú adresu.";
    if (!message || message.trim().length < 10) errors.message = "Správa musí byť dlhšia (min. 10 znakov).";
    
    return errors;
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const errors = validate(formData);

    if (Object.keys(errors).length > 0) {
      setFormState({ status: 'error', errors, message: 'Prosím, opravte chyby vo formulári.' });
      return;
    }

    setFormState({ status: 'submitting', errors: {}, message: 'Odosielam správu...' });

    // --- TU VLOŽIŠ SVOJ WEB3FORMS KĽÚČ ---
    formData.append("access_key", "1f420586-cb75-41e0-b157-406ed683a25a"); 
    formData.append("subject", `Nový dopyt z webu: ${formData.get("name")}`);

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setFormState({ status: 'success', errors: {}, message: 'Ďakujem! Vaša správa bola úspešne doručená. Ozvem sa vám čo najskôr.' });
        (e.target as HTMLFormElement).reset();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      setFormState({ status: 'error', errors: {}, message: 'Došlo k chybe pri odosielaní. Skúste mi prosím napísať priamo na email.' });
    }
  };

  return { formState, submit };
};

const useHashRouter = (onHashMatch: (hash: string) => void) => {
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      onHashMatch(hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [onHashMatch]);
};

// ============================================================================
// 4. REUSABLE UI COMPONENTS
// ============================================================================

const MagneticButton = ({ children, className, onClick, type = "button", disabled = false }: any) => {
  const ref = useRef<HTMLButtonElement>(null);
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current || disabled) return;
    const { clientX, clientY } = e;
    const { width, height, left, top } = ref.current.getBoundingClientRect();
    const x = (clientX - (left + width / 2)) * 0.3;
    const y = (clientY - (top + height / 2)) * 0.3;
    gsap.to(ref.current, { x, y, duration: 1, ease: "power3.out" });
  };
  const handleMouseLeave = () => {
    if (!ref.current || disabled) return;
    gsap.to(ref.current, { x: 0, y: 0, duration: 1, ease: "elastic.out(1, 0.3)" });
  };
  return (
    <button ref={ref} type={type} disabled={disabled} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} onClick={onClick} 
      className={`relative flex items-center justify-center gap-2 px-8 py-4 rounded-full font-bold transition-all z-10 
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'} ${className}`}>
      {children}
    </button>
  );
};

const LegalModal = ({ type, onClose }: { type: string | null, onClose: () => void }) => {
  if (!type || !LEGAL_DATA[type]) return null;
  const data = LEGAL_DATA[type];
  
  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl flex flex-col custom-scrollbar animate-in fade-in zoom-in-95 duration-200">
        <div className="sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/10 px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h3 className="text-xl font-bold">{data.title}</h3>
            <p className="text-xs text-gray-500 font-mono mt-1">Účinné od: {data.lastUpdated}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
        </div>
        <div className="p-6 md:p-10 space-y-8">
          {data.sections.map((block, i) => (
            <div key={i}>
              <h4 className="text-white font-bold mb-3">{block.h}</h4>
              <p className="text-gray-400 text-sm leading-relaxed">{block.p}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 5. MAIN PAGE
// ============================================================================

export default function PortfolioPage() {
  const mainRef = useRef(null);
  
  const [activeLegalModal, setActiveLegalModal] = useState<string | null>(null);
  const [hasCookieConsent, setHasCookieConsent] = useState<boolean>(true);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const { formState, submit: handleFormSubmit } = useContactForm();
  const smoothScroll = useSmoothScroll();

  useHashRouter((hash) => {
    if (Object.keys(LEGAL_DATA).includes(hash)) {
      setActiveLegalModal(hash);
    } else {
      setActiveLegalModal(null);
    }
  });

  useLayoutEffect(() => {
    if (typeof window !== "undefined") {
      window.history.scrollRestoration = "manual";
      window.scrollTo(0, 0);
      setHasCookieConsent(localStorage.getItem("cookie_consent_v5") !== null);
    }
  }, []);

  useEffect(() => {
    const lenis = new Lenis({ duration: 1.2, smoothWheel: true });
    function raf(time: number) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      if (!prefersReducedMotion) {
        
        gsap.from(".hero-elem", {
          y: 40,
          opacity: 0,
          duration: 1.5,
          stagger: 0.15,
          ease: "expo.out",
          delay: 0.2
        });

        gsap.utils.toArray('.gsap-fade').forEach((el: any) => {
          gsap.from(el, { y: 60, opacity: 0, duration: 1.2, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 85%" } });
        });

        // --- INSANE TEXT REVEAL (Opravené: Bez deštrukcie tvojho krásneho HTML!) ---
        gsap.utils.toArray('.insane-reveal').forEach((el: any) => {
          gsap.from(el, {
            y: 80, 
            opacity: 0, 
            duration: 1.5, 
            ease: "power4.out",
            scrollTrigger: { 
              trigger: el, 
              start: "top 85%", 
              toggleActions: "play none none none" 
            }
          });
        });

        gsap.to('.svg-1', { y: 400, rotation: 180, ease: "none", scrollTrigger: { trigger: mainRef.current, start: "top top", end: "bottom bottom", scrub: 1 }});
        gsap.to('.svg-2', { y: -500, rotation: -90, ease: "none", scrollTrigger: { trigger: mainRef.current, start: "top top", end: "bottom bottom", scrub: 2 }});
        gsap.to('.svg-3', { scale: 1.5, opacity: 0, ease: "none", scrollTrigger: { trigger: '#work', start: "top bottom", end: "bottom top", scrub: true }});
        gsap.to('.svg-4', { x: 300, rotation: 45, ease: "none", scrollTrigger: { trigger: '#work', start: "top bottom", end: "bottom top", scrub: 1.5 }});
        gsap.to('.svg-5', { scale: 0.5, y: -200, ease: "none", scrollTrigger: { trigger: '#pricing', start: "top bottom", end: "bottom top", scrub: 1 }});
        gsap.to('.svg-6', { rotation: 720, ease: "none", scrollTrigger: { trigger: mainRef.current, start: "top top", end: "bottom bottom", scrub: 3 }});
        gsap.to('.svg-7', { x: -200, y: 300, ease: "none", scrollTrigger: { trigger: '#pricing', start: "top bottom", end: "bottom top", scrub: true }});
        gsap.to('.svg-8', { opacity: 0.5, scale: 1.2, ease: "none", scrollTrigger: { trigger: '#contact', start: "top bottom", end: "center center", scrub: true }});
        gsap.to('.svg-9', { y: -500, ease: "none", scrollTrigger: { trigger: mainRef.current, start: "center center", end: "bottom top", scrub: 2 }});

        // --- PROCES SEKCE: RESPONZÍVNY PINNING (Mobile Fix) ---
        const mm = gsap.matchMedia();

        gsap.to(".process-fill", {
          height: "100%", ease: "none",
          scrollTrigger: { trigger: ".process-wrap", start: "top center", end: "bottom center", scrub: true }
        });

        mm.add("(min-width: 1024px)", () => {
          ScrollTrigger.create({
            trigger: ".process-wrap",
            start: "top 120px", 
            end: "bottom bottom", 
            pin: ".process-sticky-content",
            pinSpacing: false
          });
        });

      }
    }, mainRef);

    return () => { lenis.destroy(); ctx.revert(); };
  }, []);

  const handleCookieAccept = (type: 'all' | 'necessary') => {
    localStorage.setItem("cookie_consent_v5", type);
    setHasCookieConsent(true);
  };

  const closeModals = () => {
    setActiveLegalModal(null);
    window.history.pushState(null, '', window.location.pathname);
  };

  return (
    <main ref={mainRef} className="bg-[#050505] min-h-screen text-white selection:bg-blue-600 relative overflow-hidden">
      
      {/* --- SEO / GEO JSON-LD PRE GOOGLE --- */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ProfessionalService",
        "name": "Dominik Jankovič - Senior Web Developer",
        "image": "https://dominikjankovic.sk/og-image.jpg",
        "description": "Tvorba prémiových webstránok a webových aplikácií na mieru v React a Next.js.",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Skalica",
          "addressRegion": "Trnavský kraj",
          "addressCountry": "SK"
        },
        "url": "https://dominikjankovic.sk",
        "telephone": SITE_CONFIG.phone,
        "email": SITE_CONFIG.email,
        "priceRange": "$$$",
        "areaServed": ["Slovensko", "Bratislava", "Trnava", "Skalica", "Česká republika"]
      }) }} />

      {/* --- SYSTEM OVERLAYS (Modals & Banners) --- */}
      <LegalModal type={activeLegalModal} onClose={closeModals} />

      {!hasCookieConsent && (
        <div className="fixed bottom-0 left-0 w-full z-[99990] p-4 pointer-events-none">
          <div className="max-w-6xl mx-auto bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 p-6 md:p-8 rounded-2xl shadow-2xl pointer-events-auto flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 animate-in slide-in-from-bottom-10">
            <div className="flex items-start gap-4 max-w-2xl">
              <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500 shrink-0"><ShieldCheck size={24} /></div>
              <div>
                <h4 className="text-white font-bold text-lg mb-2">Nastavenie súkromia</h4>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Tento web využíva cookies pre zabezpečenie technického chodu a analytiku. Žiadne údaje nie sú predávané tretím stranám. 
                  Prečítajte si <a href="#cookies" className="text-blue-400 hover:underline">Cookies politiku</a>.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0">
              <button onClick={() => handleCookieAccept('necessary')} className="px-6 py-3 text-sm font-medium border border-white/10 hover:bg-white/5 text-white rounded-xl transition-colors flex items-center justify-center gap-2"><Settings2 size={16}/> Iba nutné</button>
              <button onClick={() => handleCookieAccept('all')} className="px-8 py-3 text-sm bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors">Súhlasím so všetkým</button>
            </div>
          </div>
        </div>
      )}
  {/* --- HEADER S LOGOM (Zafixovaný LEN na mobile) --- */}
  <header className="fixed md:absolute top-0 left-0 w-full z-[100] px-6 py-4 md:py-6 flex justify-between items-center pointer-events-none bg-[#050505]/80 md:bg-transparent backdrop-blur-md md:backdrop-blur-none border-b border-white/5 md:border-transparent transition-all duration-300">
        <div className="pointer-events-auto flex items-center gap-3 cursor-pointer group" onClick={(e: any) => smoothScroll(e, '#home')}>
          
          {/* TVOJE VLASTNÉ LOGO */}
          <div className="group-hover:rotate-6 group-hover:scale-110 transition-all duration-300 flex items-center justify-center">
            <Image 
              src="/LOGOFINAL.svg" 
              alt="Dominik Jankovič Logo" 
              width={90} 
              height={90} 
              priority 
              className="object-contain"
            />
          </div>
        </div>
      </header>
      {/* --- ANIMOVANÉ HAMBURGER TLAČIDLO --- */}
      <button 
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
        className="md:hidden fixed top-6 right-6 z-[9999999] w-12 h-12 flex flex-col items-center justify-center gap-[6px] bg-[#0a0a0a]/80 border border-white/10 rounded-full backdrop-blur-md shadow-[0_0_30px_rgba(0,0,0,0.5)] transition-colors hover:bg-white/10"
        aria-label="Toggle Menu"
      >
        <motion.span animate={isMobileMenuOpen ? { rotate: 45, y: 8 } : { rotate: 0, y: 0 }} className="w-5 h-[2px] bg-white rounded-full block transition-all duration-300" />
        <motion.span animate={isMobileMenuOpen ? { opacity: 0 } : { opacity: 1 }} className="w-5 h-[2px] bg-white rounded-full block transition-all duration-300" />
        <motion.span animate={isMobileMenuOpen ? { rotate: -45, y: -8 } : { rotate: 0, y: 0 }} className="w-5 h-[2px] bg-white rounded-full block transition-all duration-300" />
      </button>

      {/* --- PREMIUM MOBILE NAVIGATION DRAWER --- */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(24px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 bg-[#030303]/95 z-[999999] flex flex-col justify-between px-8 pb-12 pt-32 overflow-hidden"
          >
            <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-blue-600/20 blur-[120px] rounded-full pointer-events-none"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-cyan-600/10 blur-[120px] rounded-full pointer-events-none"></div>

            <div className="flex flex-col gap-6 relative z-10">
              {NAV_ITEMS.map((item, i) => (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, y: 40, rotateX: -20 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                >
                  <a 
                    href={item.url} 
                    onClick={(e) => { 
                      setIsMobileMenuOpen(false); 
                      smoothScroll(e, item.url); 
                    }} 
                    className="group flex items-center gap-6"
                  >
                    <span className="text-sm font-mono text-blue-500/50 group-hover:text-cyan-400 transition-colors">
                      0{i + 1}
                    </span>
                    <span className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 group-hover:to-white transition-all duration-500">
                      {item.name}
                    </span>
                  </a>
                </motion.div>
              ))}
            </div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, delay: NAV_ITEMS.length * 0.1 + 0.2 }}
              className="flex flex-col gap-4 relative z-10 border-t border-white/10 pt-8"
            >
              <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">Začnime projekt</p>
              
              <a href={`tel:${SITE_CONFIG.phone}`} className="text-lg font-medium text-white hover:text-cyan-400 transition-colors flex items-center gap-2">
                <Phone size={16} className="text-cyan-400"/> {SITE_CONFIG.displayPhone}
              </a>
              <a href={`mailto:${SITE_CONFIG.email}`} className="text-lg font-medium text-white hover:text-cyan-400 transition-colors flex items-center gap-2">
                <Mail size={16} className="text-cyan-400"/> {SITE_CONFIG.email}
              </a>

              <div className="flex gap-6 mt-4">
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-gray-400 hover:text-white transition-colors">LinkedIn</a>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-gray-400 hover:text-white transition-colors">GitHub</a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- ZACHOVANÉ: 10 ABSTRAKTNÝCH SVG PRVKOV V POZADÍ --- */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden mix-blend-screen opacity-30">
        <svg className="svg-1 absolute top-[10%] left-[5%] w-64 h-64 text-white/10" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" fill="none"/></svg>
        <svg className="svg-2 absolute top-[20%] right-[10%] w-40 h-40 text-blue-500/20" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" stroke="currentColor" strokeWidth="0.5" fill="none"/><path d="M10 10 L90 90 M90 10 L10 90" stroke="currentColor" strokeWidth="0.5"/></svg>
        <svg className="svg-3 absolute top-[40%] left-[2%] w-96 h-96 text-purple-500/10" viewBox="0 0 200 200"><path d="M100 0 L200 100 L100 200 L0 100 Z" stroke="currentColor" strokeWidth="1" fill="none"/><circle cx="100" cy="100" r="50" stroke="currentColor" fill="none"/></svg>
        <svg className="svg-4 absolute top-[50%] right-[5%] w-72 h-72 text-white/10" viewBox="0 0 100 100"><path d="M50 10 A40 40 0 0 1 90 50" stroke="currentColor" fill="none" strokeWidth="1"/><path d="M50 20 A30 30 0 0 1 80 50" stroke="currentColor" fill="none" strokeWidth="0.5"/></svg>
        <svg className="svg-5 absolute top-[65%] left-[15%] w-32 h-32 text-blue-600/20" viewBox="0 0 100 100"><polygon points="50,5 95,25 95,75 50,95 5,75 5,25" stroke="currentColor" strokeWidth="1" fill="none"/></svg>
        <svg className="svg-6 absolute top-[75%] right-[20%] w-48 h-48 text-white/20" viewBox="0 0 100 100"><line x1="0" y1="20" x2="100" y2="20" stroke="currentColor" strokeWidth="0.5"/><line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeWidth="1"/><line x1="0" y1="80" x2="100" y2="80" stroke="currentColor" strokeWidth="0.2"/></svg>
        <svg className="svg-7 absolute top-[85%] left-[10%] w-80 h-32 text-purple-500/20" viewBox="0 0 200 50"><path d="M0 25 Q 25 0, 50 25 T 100 25 T 150 25 T 200 25" stroke="currentColor" fill="none" strokeWidth="1"/></svg>
        <svg className="svg-8 absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] text-blue-900/30 opacity-0" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="0.5" fill="none"/></svg>
        <svg className="svg-9 absolute top-[120%] right-[-5%] w-64 h-64 text-white/10" viewBox="0 0 100 100"><path d="M0 100 L100 0 M20 100 L100 20 M40 100 L100 40" stroke="currentColor" strokeWidth="0.5"/></svg>
        <svg className="absolute top-[30%] left-[50%] w-16 h-16 text-cyan-500/30 animate-[spin_12s_linear_infinite]" viewBox="0 0 100 100"><polygon points="50,0 60,40 100,50 60,60 50,100 40,60 0,50 40,40" fill="currentColor"/></svg>
      </div>

      <div className="hidden md:block">
        <AnimeNavBar items={NAV_ITEMS} defaultActive="Domov" />
      </div>

      {/* --- 1. HERO --- */}
      <section id="home" className="min-h-[100dvh] flex flex-col items-center justify-center text-center px-4 sm:px-6 relative z-10 pt-24 pb-16 overflow-hidden">
        <h1 className="sr-only">Tvorba prémiových webstránok a aplikácií na mieru - Dominik Jankovič Skalica Slovensko</h1>

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120vw] h-[120vw] md:w-[60vw] md:h-[60vw] max-w-[1000px] max-h-[1000px] bg-gradient-to-tr from-blue-900/15 to-cyan-900/10 rounded-full blur-[100px] md:blur-[150px] pointer-events-none mix-blend-screen"></div>
        
        <div className="hero-elem inline-flex items-center gap-3 px-5 py-2.5 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-xl mb-10 md:mb-14 shadow-[0_0_30px_rgba(255,255,255,0.02)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          <span className="text-xs font-mono text-white/80 uppercase tracking-[0.2em] pt-[1px]">System.Online</span>
        </div>
        
        <div className="hero-elem mb-8 md:mb-10 w-full flex justify-center" aria-hidden="true">
          <HyperText className="text-[13vw] sm:text-[10vw] md:text-7xl lg:text-[6.5rem] font-extrabold tracking-tighter leading-[1.1]" text="Dominik Jankovič" duration={1400} />
        </div>
        
        <h2 className="hero-elem text-lg sm:text-xl md:text-3xl lg:text-4xl font-light text-transparent bg-clip-text bg-gradient-to-br from-white via-gray-300 to-gray-600 mb-14 md:mb-20 max-w-[95%] sm:max-w-[80%] md:max-w-3xl leading-relaxed md:leading-snug">
          Nekupujete si šablónu. <br className="hidden sm:block"/> 
          Budujem nástroje, ktoré <span className="font-medium text-white">dominujú trhu.</span>
        </h2>

        <div className="hero-elem flex flex-col sm:flex-row gap-5 sm:gap-10 items-center w-full sm:w-auto px-2 sm:px-0">
          <MagneticButton onClick={(e: any) => smoothScroll(e, '#pricing')} className="bg-white text-black w-full sm:w-auto min-w-[220px] py-4 rounded-full text-sm font-bold tracking-wide shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(255,255,255,0.2)] transition-shadow">
            Preskúmať cenník
          </MagneticButton>
          
          <a href="#contact" onClick={(e) => smoothScroll(e, '#contact')} className="group flex items-center justify-center gap-3 py-3 px-6 text-sm font-semibold uppercase tracking-widest text-gray-400 hover:text-white transition-all duration-300 w-full sm:w-auto mt-2 sm:mt-0">
            Nezáväzný hovor 
            <ArrowUpRight size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform opacity-70 group-hover:opacity-100 group-hover:text-blue-400"/>
          </a>
        </div>
      </section>

      {/* --- 2. METRIKY --- */}
      <section className="py-20 px-6 border-y border-white/5 bg-white/[0.01] relative z-10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-12 divide-x divide-white/5">
          {[
            { v: "100%", l: "Performance Skóre" },
            { v: "0", l: "Šablón a kompromisov" },
            { v: "24/7", l: "Priama komunikácia" },
            { v: "Q4", l: "Dostupná kapacita" }
          ].map((s, i) => (
            <div key={i} className={`gsap-fade flex flex-col items-center text-center ${i !== 0 ? 'md:pl-12' : ''}`}>
              <span className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/30 mb-3">{s.v}</span>
              <span className="text-xs text-white/50 uppercase tracking-widest font-mono">{s.l}</span>
            </div>
          ))}
        </div>
      </section>

      {/* --- 3. SLUŽBY --- */}
      <section id="services" className="py-32 px-6 max-w-7xl mx-auto relative z-10">
        <div className="gsap-fade mb-20 md:flex justify-between items-end">
          <div className="max-w-2xl">
            {/* TVOJ NÁDHERNÝ NADPIS JE SPÄŤ! */}
            <h2 className="insane-reveal text-4xl md:text-6xl font-black tracking-tighter mb-6">Expertíza & <span className="text-blue-500 italic font-serif">Služby.</span></h2>
            <p className="text-gray-400 text-lg">Zastrešujem kompletný životný cyklus digitálneho produktu. Od prvej skice až po nasadenie na produkčný server.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Layout, title: "UX/UI Dizajn", desc: "Dizajnujem rozhrania, ktoré vedú oko používateľa presne tam, kam potrebujete. Žiadny vizuálny smog, len čistá konverzia." },
            { icon: Code2, title: "Frontend Vývoj", desc: "Pixel-perfect implementácia v Reacte a Next.js. Rýchlosť načítania pod sekundu a bezchybná responzivita." },
            { icon: Zap, title: "Interakcie & GSAP", desc: "Statický web je nuda. Vdýchnem vášmu projektu život pomocou premyslených mikrointerakcií a plynulých animácií." }
          ].map((s, i) => (
            <div key={i} className="gsap-fade group p-10 rounded-3xl bg-[#0a0a0a] border border-white/5 hover:border-blue-500/30 transition-all duration-500 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-colors"></div>
              <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform"><s.icon className="text-blue-400" size={28} /></div>
              <h3 className="text-2xl font-bold mb-4">{s.title}</h3>
              <p className="text-gray-400 leading-relaxed text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --- 4. PROJEKTY (Teraz využíva next/image) --- */}
      <section id="work" className="py-32 px-6 max-w-7xl mx-auto relative z-10 border-t border-white/5">
        {/* TVOJ NÁDHERNÝ NADPIS JE SPÄŤ! */}
        <h2 className="insane-reveal text-4xl md:text-6xl font-black mb-24 text-center">
          Vybrané <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-400 italic font-serif">Realizácie.</span>
        </h2>
        
        <div className="flex flex-col gap-32 md:gap-40">
          {PROJECTS_DATA.map((p, i) => (
            <div key={p.id} className={`gsap-fade flex flex-col lg:flex-row gap-12 lg:gap-16 items-center ${i % 2 !== 0 ? 'lg:flex-row-reverse' : ''}`}>
              
              <a href={p.href} target="_blank" rel="noopener noreferrer" className="w-full lg:w-[55%] relative group cursor-pointer block">
                <div className="absolute inset-0 bg-blue-600/10 rounded-3xl translate-y-3 translate-x-3 md:translate-y-4 md:translate-x-4 -z-10 transition-transform duration-500 group-hover:translate-y-6 group-hover:translate-x-6"></div>
                <div className="overflow-hidden rounded-3xl aspect-[4/3] border border-white/10 relative bg-[#0a0a0a] shadow-2xl">
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-transparent transition-colors duration-700 z-10 pointer-events-none"></div>
                  
                  {/* NOVÝ NEXT/IMAGE COMPONENT */}
                  <Image 
                    src={p.image} 
                    alt={`Ukážka prác: ${p.title} - ${p.category}`}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover transition-transform duration-1000 group-hover:scale-105" 
                  />
                  
                </div>
              </a>
              
              <div className="w-full lg:w-[45%] flex flex-col">
                <div className="flex items-center gap-4 mb-6">
                  <span className="px-4 py-1.5 bg-blue-500/10 text-cyan-400 text-xs font-mono font-bold rounded-full tracking-widest uppercase">
                    {p.category}
                  </span>
                </div>
                
                <motion.h3 
                  initial={{ backgroundPosition: "200% center" }}
                  whileInView={{ backgroundPosition: "0% center" }}
                  viewport={{ once: false, margin: "-10%" }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="text-4xl md:text-5xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-[#0a1526] bg-[length:200%_auto]"
                >
                  {p.title}
                </motion.h3>
                
                <div className="space-y-6 mb-10 border-l-2 border-blue-500/30 pl-6">
                  <div>
                    <h4 className="text-white/40 text-xs uppercase tracking-widest mb-2 font-bold">Problém</h4>
                    <p className="text-gray-300 text-sm md:text-base leading-relaxed">{p.problem}</p>
                  </div>
                  <div>
                    <h4 className="text-white/40 text-xs uppercase tracking-widest mb-2 font-bold">Riešenie</h4>
                    <p className="text-gray-300 text-sm md:text-base leading-relaxed">{p.solution}</p>
                  </div>
                  <div>
                    <h4 className="text-white/40 text-xs uppercase tracking-widest mb-2 font-bold">Výsledok</h4>
                    <p className="text-white font-bold text-lg">{p.result}</p>
                  </div>
                </div>

                <a href={p.href} target="_blank" rel="noopener noreferrer" className="relative group inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-full text-white text-sm font-bold tracking-wide overflow-hidden border border-blue-900/50 shadow-[0_0_20px_rgba(30,58,138,0.2)] hover:shadow-[0_0_40px_rgba(59,130,246,0.4)] transition-all duration-500 w-full sm:w-fit">
                  <span className="absolute inset-0 w-full h-full bg-[#0a1526]"></span>
                  <span className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-[#0a1526] via-blue-600 to-cyan-400 opacity-0 group-hover:opacity-100 group-hover:-translate-x-1/2 transition-all duration-700 ease-out z-0"></span>
                  <span className="relative z-10 flex items-center gap-2">
                    Navštíviť live web
                    <ArrowUpRight size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300"/>
                  </span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --- 5. CENNÍK --- */}
      <section id="pricing" className="py-32 px-6 max-w-7xl mx-auto relative z-10 border-t border-white/5">
        <div className="text-center mb-20 gsap-fade">
          {/* TVOJ NÁDHERNÝ NADPIS JE SPÄŤ! */}
          <h2 className="insane-reveal text-4xl md:text-6xl font-black mb-4">Transparentné <span className="text-blue-500 italic font-serif">Ceny.</span></h2>
          <p className="text-gray-400 max-w-2xl mx-auto">Väčšina agentúr skrýva svoje ceny. Ja verím v otvorenosť. Vyberte si balík, ktorý zodpovedá vašim cieľom.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {PRICING_DATA.map((plan) => (
            <div key={plan.id} className={`gsap-fade flex flex-col p-8 rounded-3xl border transition-all duration-300 ${plan.isPopular ? 'border-blue-500 bg-blue-900/10 shadow-[0_0_40px_rgba(59,130,246,0.15)] relative md:-translate-y-4' : 'border-white/10 bg-[#0a0a0a] hover:border-white/30'}`}>
              {plan.isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg">
                  Najčastejšia voľba
                </div>
              )}
              
              <h3 className="text-2xl font-bold mb-3">{plan.title}</h3>
              <p className="text-gray-400 text-sm mb-8 h-12 leading-relaxed">{plan.description}</p>
              
              <div className="mb-8">
                <span className={`text-4xl font-black ${plan.isPopular ? 'text-blue-400' : 'text-white'}`}>{plan.price}</span>
              </div>
              
              <ul className="space-y-4 mb-10 flex-1">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                    <CheckCircle2 size={18} className={`shrink-0 mt-0.5 ${plan.isPopular ? 'text-blue-500' : 'text-white/40'}`}/>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button 
                onClick={(e) => smoothScroll(e, '#contact')} 
                className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all ${plan.isPopular ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'}`}
              >
                Vybrať program
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* --- 6. TECH STACK --- */}
      <section className="py-24 border-y border-white/5 bg-[#030303] overflow-hidden flex relative z-10">
        <style>{`
          @keyframes smooth-marquee {
            0% { transform: translate3d(0, 0, 0); }
            100% { transform: translate3d(-50%, 0, 0); }
          }
          .animate-smooth-marquee {
            display: flex;
            width: max-content;
            animation: smooth-marquee 30s linear infinite; 
            will-change: transform;
          }
          .animate-smooth-marquee:hover {
            animation-play-state: paused;
          }
        `}</style>
        
        <div className="absolute left-0 top-0 w-24 md:w-48 h-full bg-gradient-to-r from-[#030303] to-transparent z-20 pointer-events-none"></div>
        <div className="absolute right-0 top-0 w-24 md:w-48 h-full bg-gradient-to-l from-[#030303] to-transparent z-20 pointer-events-none"></div>
        
        <div className="animate-smooth-marquee flex items-center">
          {[...TECHNOLOGIES_DATA, ...TECHNOLOGIES_DATA, ...TECHNOLOGIES_DATA, ...TECHNOLOGIES_DATA].map((tech, i) => (
            <div key={i} className="flex items-center px-8 md:px-16 shrink-0">
              <span className="text-4xl md:text-6xl font-black text-white/5 uppercase tracking-tighter hover:text-white/80 transition-colors duration-300 cursor-pointer">
                {tech}
              </span>
              <span className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.6)] ml-16 md:ml-32"></span>
            </div>
          ))}
        </div>
      </section>

      {/* --- 7. PROCES (Mobile Fix) --- */}
      <section id="process" className="py-24 md:py-32 px-6 max-w-7xl mx-auto process-wrap relative z-10 overflow-hidden">
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-12 lg:gap-20 items-start">
          
          <div className="w-full lg:col-span-5 h-full">
            <div className="process-sticky-content lg:pt-4">
              {/* TVOJ NÁDHERNÝ NADPIS JE SPÄŤ! */}
              <h2 className="insane-reveal text-4xl md:text-6xl font-black tracking-tighter mb-6 text-white">
                Ako to u mňa <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-400 italic font-serif">funguje.</span>
              </h2>
              <p className="text-gray-400 text-lg md:text-xl leading-relaxed max-w-xl">
                Dobrý web nevzniká náhodou. Je to výsledok úprimnej komunikácie, jasného plánu a poctivej práce. Prevediem vás celým procesom od prvej myšlienky až po spustenie, aby ste vždy presne vedeli, čo sa deje.
              </p>
            </div>
          </div>
          
          <div className="w-full lg:col-span-7 relative mt-10 lg:mt-0">
            <div className="relative">
              
              <div className="absolute left-5 md:left-8 top-0 bottom-0 w-[2px] bg-white/10 -translate-x-1/2 rounded-full"></div>
              <div className="process-fill absolute left-5 md:left-8 top-0 w-[2px] bg-gradient-to-b from-blue-500 to-cyan-400 h-0 -translate-x-1/2 z-0 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.6)]"></div>

              <div className="flex flex-col">
                {PROCESS_DATA.map((step, i) => (
                  <div key={i} className="flex relative z-10 mb-16 md:mb-24 last:mb-0">
                    <div className="w-10 md:w-16 flex-shrink-0 flex justify-center pt-1">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#030303] border border-white/20 flex items-center justify-center text-sm font-mono font-bold text-gray-500 shadow-[0_0_20px_rgba(0,0,0,1)] relative z-10 transition-colors duration-500 hover:border-cyan-400 hover:text-cyan-400">
                        {step.step}
                      </div>
                    </div>
                    
                    <div className="flex-1 pl-6 md:pl-10">
                      <motion.h3 
                        initial={{ backgroundPosition: "200% center" }}
                        whileInView={{ backgroundPosition: "0% center" }}
                        viewport={{ once: false, margin: "-20%" }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                        className="text-2xl md:text-3xl font-bold mb-4 mt-1 md:mt-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-[#1a2b4c] bg-[length:200%_auto]"
                      >
                        {step.title}
                      </motion.h3>
                      <p className="text-gray-400 text-base md:text-lg leading-relaxed max-w-xl">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- 8. FAQ --- */}
      <section className="py-32 px-6 max-w-4xl mx-auto relative z-10 border-t border-white/5">
        {/* TVOJ NÁDHERNÝ NADPIS JE SPÄŤ! */}
        <h2 className="insane-reveal text-3xl md:text-5xl font-black mb-16 text-center">Časté <span className="text-blue-500 italic font-serif">Otázky.</span></h2>
        <div className="space-y-4">
          {FAQ_DATA.map((faq, i) => (
            <div key={i} className="gsap-fade border-b border-white/10 overflow-hidden">
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full py-8 flex justify-between items-center text-left hover:text-blue-400 transition-colors group">
                <span className="text-xl font-bold pr-8">{faq.q}</span>
                <div className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 transition-all duration-300 ${openFaq === i ? "border-blue-500 bg-blue-500/10 text-blue-500" : "border-white/20 group-hover:border-blue-400"}`}>
                  <ChevronDown size={20} className={`transform transition-transform duration-500 ${openFaq === i ? "rotate-180" : ""}`} />
                </div>
              </button>
              <div className={`overflow-hidden transition-all duration-500 ease-in-out ${openFaq === i ? "max-h-60 opacity-100 pb-8" : "max-h-0 opacity-0"}`}>
                <p className="text-gray-400 leading-relaxed pr-12">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --- 9. KONTAKT --- */}
      <section id="contact" className="py-32 px-6 max-w-5xl mx-auto relative z-10">
        <div className="bg-gradient-to-b from-[#0a0a0a] to-[#050505] border border-white/10 rounded-[3rem] p-8 md:p-16 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 relative z-10">
            <div>
              {/* TVOJ NÁDHERNÝ NADPIS JE SPÄŤ! */}
              <h2 className="insane-reveal text-4xl md:text-6xl font-black tracking-tighter mb-6">Pripravený na <br/><span className="text-blue-500 italic font-serif">Upgrade?</span></h2>
              <p className="text-gray-400 text-lg mb-10">Nestrácajme čas s priemernými riešeniami. Napíšte mi a poďme postaviť niečo, čo bude generovať reálne výsledky.</p>
              
              <div className="space-y-6">
                <div>
                  <h4 className="text-white/40 text-xs uppercase tracking-widest font-bold mb-2">Telefonicky</h4>
                  <a href={`tel:${SITE_CONFIG.phone}`} className="text-xl font-bold hover:text-blue-400 transition-colors">{SITE_CONFIG.displayPhone}</a>
                </div>
                <div>
                  <h4 className="text-white/40 text-xs uppercase tracking-widest font-bold mb-2">Email</h4>
                  <a href={`mailto:${SITE_CONFIG.email}`} className="text-xl font-bold hover:text-blue-400 transition-colors">{SITE_CONFIG.email}</a>
                </div>
              </div>
            </div>

            <form onSubmit={handleFormSubmit} noValidate className="space-y-8">
              <div className="relative group">
                <input type="text" id="name" name="name" disabled={formState.status === 'submitting'} className={`w-full bg-transparent border-b ${formState.errors.name ? 'border-red-500' : 'border-white/20 focus:border-blue-500'} py-4 text-white focus:outline-none transition-colors peer disabled:opacity-50`} placeholder=" " />
                <label htmlFor="name" className={`absolute left-0 top-4 text-sm transition-all peer-focus:-top-2 peer-focus:text-xs peer-valid:-top-2 peer-valid:text-xs pointer-events-none ${formState.errors.name ? 'text-red-500' : 'text-white/40 peer-focus:text-blue-400 peer-valid:text-white/60'}`}>Vaše meno / Firma *</label>
                {formState.errors.name && <p className="text-red-500 text-xs mt-1 absolute -bottom-5">{formState.errors.name}</p>}
              </div>
              
              <div className="relative group mt-10">
                <input type="email" id="email" name="email" disabled={formState.status === 'submitting'} className={`w-full bg-transparent border-b ${formState.errors.email ? 'border-red-500' : 'border-white/20 focus:border-blue-500'} py-4 text-white focus:outline-none transition-colors peer disabled:opacity-50`} placeholder=" " />
                <label htmlFor="email" className={`absolute left-0 top-4 text-sm transition-all peer-focus:-top-2 peer-focus:text-xs peer-valid:-top-2 peer-valid:text-xs pointer-events-none ${formState.errors.email ? 'text-red-500' : 'text-white/40 peer-focus:text-blue-400 peer-valid:text-white/60'}`}>Váš e-mail *</label>
                {formState.errors.email && <p className="text-red-500 text-xs mt-1 absolute -bottom-5">{formState.errors.email}</p>}
              </div>

              <div className="relative group mt-10">
                <textarea id="message" name="message" rows={3} disabled={formState.status === 'submitting'} className={`w-full bg-transparent border-b ${formState.errors.message ? 'border-red-500' : 'border-white/20 focus:border-blue-500'} py-4 text-white focus:outline-none transition-colors peer resize-none disabled:opacity-50`} placeholder=" "></textarea>
                <label htmlFor="message" className={`absolute left-0 top-4 text-sm transition-all peer-focus:-top-2 peer-focus:text-xs peer-valid:-top-2 peer-valid:text-xs pointer-events-none ${formState.errors.message ? 'text-red-500' : 'text-white/40 peer-focus:text-blue-400 peer-valid:text-white/60'}`}>Opíšte svoj projekt a ciele... *</label>
                {formState.errors.message && <p className="text-red-500 text-xs mt-1 absolute -bottom-5">{formState.errors.message}</p>}
              </div>

              {formState.status === 'error' && <div className="p-3 mt-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2"><AlertCircle size={16}/> {formState.message}</div>}
              {formState.status === 'success' && <div className="p-3 mt-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm flex items-center gap-2"><Check size={16}/> {formState.message}</div>}

              <button type="submit" disabled={formState.status === 'submitting'} className="w-full bg-white text-black font-black uppercase tracking-widest text-sm py-5 rounded-xl hover:bg-blue-500 hover:text-white transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] disabled:opacity-70 flex justify-center items-center gap-2">
                {formState.status === 'submitting' ? <><Loader2 className="animate-spin" size={18}/> Odosielam...</> : 'Odoslať dopyt'}
              </button>
              
              <p className="text-center text-xs text-white/30">Odoslaním súhlasíte so spracovaním podľa <a href="#privacy" className="underline hover:text-white">GDPR</a>.</p>
            </form>
          </div>
        </div>
      </section>
{/* --- 10. ANIMATED FOOTER S LOGOM --- */}
        
    

    
      {/* --- 10. ANIMATED FOOTER --- */}
      <div className="relative z-10">
        <Footer 
          contactInfo={{
            email: SITE_CONFIG.email,
            phone: SITE_CONFIG.displayPhone
          }}
          leftLinks={[
            { href: "#privacy", label: "Ochrana osobných údajov" }, 
            { href: "#cookies", label: "Cookies" },
            { href: "#terms", label: "Podmienky používania (VOP)" }
          ]}
          rightLinks={[
            { href: "https://github.com", label: "GitHub" }, 
            { href: "https://linkedin.com", label: "LinkedIn" }
          ]}
          copyrightText={`© ${SITE_CONFIG.year} Dominik Jankovič. Všetky práva vyhradené.`}
          barCount={60}
        />
      </div>
    </main>
  );
}