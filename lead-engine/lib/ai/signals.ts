import "server-only";
import type { Company, Evidence } from "../types";
import { categoryOf } from "../types";
import { normalizePhone, type PageFacts, type SiteFacts } from "./web";

/**
 * Z faktov o webe vytvorí evidence (E1, E2, …) a typované signály.
 * Každý signál odkazuje na evidence — nič sa netvrdí bez zdroja.
 */

export type Signal = { value: boolean; evidence: string[] };

export type Signals = {
  hasWebsite: boolean;
  siteOk: boolean;
  /** false = obsah webu sa nedal automaticky prečítať (JS stránka) → o obsahu nič netvrdíme. */
  readable: boolean;
  siteError: string | null;
  mobileViewport: Signal;
  https: Signal;
  phoneFound: Signal;
  phoneMatchesLead: Signal;
  phoneClickable: Signal;
  phoneLowOnPage: Signal;
  emailFound: Signal;
  contactForm: Signal;
  galleryPage: Signal & { images: number; url: string | null };
  homeImages: number;
  servicesClear: Signal & { items: string[] };
  cityMentioned: Signal;
  openingHours: Signal;
  social: Signal & { links: string[] };
  history: Signal & { text: string | null };
  references: Signal;
  copyrightYear: Signal & { year: number | null };
  h1: string | null;
  isGalleryVertical: boolean;
};

export function collectEvidence(company: Company, site: SiteFacts | null) {
  const evidence: Evidence[] = [];
  const add = (e: Omit<Evidence, "id" | "checked_at">): string => {
    const id = `E${evidence.length + 1}`;
    evidence.push({ ...e, id, checked_at: site?.fetchedAt ?? new Date().toISOString() });
    return id;
  };
  const sig = (value: boolean, ...ev: (string | null)[]): Signal => ({
    value,
    evidence: ev.filter((x): x is string => !!x),
  });

  const cat = categoryOf(company.category);
  const pages = site?.pages ?? [];
  const home = pages.find((p) => p.kind === "home") ?? null;
  const byKind = (k: PageFacts["kind"]) => pages.find((p) => p.kind === k) ?? null;
  const pageLabel = (p: PageFacts) =>
    ({ home: "Úvodná stránka", contact: "Kontakt", gallery: "Galéria / realizácie", services: "Služby", about: "O nás" })[
      p.kind
    ];
  const webEv = (p: PageFacts, excerpt: string) =>
    add({ source: "web", url: p.url, page: pageLabel(p), excerpt: excerpt.slice(0, 280) });

  // Kontakt zadaný človekom / importom = manuálny zdroj (nie overený webom).
  if (company.phone) add({ source: "manual", url: null, page: "Záznam leadu", excerpt: `Telefón: ${company.phone}` });

  if (!company.website || !site) {
    add({
      source: "manual",
      url: null,
      page: "Záznam leadu",
      excerpt: "Pri firme nie je uvedený vlastný web.",
    });
    return {
      evidence,
      signals: emptySignals(false, null, cat.gallery),
    };
  }

  if (!site.ok || !home) {
    add({ source: "web", url: site.input, page: "Úvodná stránka", excerpt: site.error ?? "Web sa nenačítal." });
    return { evidence, signals: emptySignals(true, site.error ?? "Web sa nenačítal.", cat.gallery) };
  }

  webEv(home, `Titulok: ${home.title ?? "(bez titulku)"}${home.h1[0] ? ` · H1: ${home.h1[0]}` : ""}`);
  if (home.jsRendered)
    webEv(
      home,
      "Obsah stránky sa načítava až cez JavaScript — text, fotky ani kontakty sme nevedeli automaticky prečítať.",
    );

  // Mobil
  const viewportEv = home.hasViewport
    ? webEv(home, "Stránka má nastavený <meta name=viewport> (zobrazenie pre mobil).")
    : webEv(home, "Stránka nemá <meta name=viewport> — na mobile sa zobrazí zmenšená desktopová verzia.");

  // Telefón
  const allTel = pages.flatMap((p) => p.telLinks.map((t) => ({ p, t })));
  const allTextPhones = pages.flatMap((p) => p.phonesInText.map((t) => ({ p, t })));
  const leadPhone = company.phone ? normalizePhone(company.phone) : null;
  const found = [...allTel, ...allTextPhones];
  const match = leadPhone ? found.find((x) => normalizePhone(x.t) === leadPhone) : null;
  const checked = pages.map(pageLabel).join(", ");
  const phoneEv = found[0]
    ? webEv(found[0].p, `Telefón na webe: ${found[0].t}`)
    : webEv(home, `Na načítaných stránkach (${checked}) sme nenašli telefónne číslo.`);
  const matchEv = match ? webEv(match.p, `Telefón z leadu sa zhoduje s číslom na webe: ${match.t}`) : null;
  const telEv = allTel[0]
    ? webEv(allTel[0].p, `Klikateľný odkaz tel:${allTel[0].t}`)
    : found[0]
      ? webEv(found[0].p, `Telefón ${found[0].t} je uvedený iba ako text (bez odkazu tel:).`)
      : null;
  const homePhonePos = home.phonePosition;
  const lowEv =
    homePhonePos !== null && homePhonePos > 0.75 && home.telLinks.length === 0
      ? webEv(home, `Telefón sa v texte úvodnej stránky objavuje až na konci (pozícia ${Math.round(homePhonePos * 100)} %).`)
      : null;

  // E-mail, formulár
  const mail = pages.find((p) => p.mailLinks.length);
  const mailEv = mail ? webEv(mail, `E-mail: ${mail.mailLinks[0]}`) : null;
  const form = pages.find((p) => p.hasForm);
  const formEv = form
    ? webEv(form, "Stránka obsahuje kontaktný formulár.")
    : !mail
      ? webEv(home, `Na načítaných stránkach (${checked}) sme nenašli e-mail ani kontaktný formulár.`)
      : null;

  // Galéria
  const gallery = byKind("gallery");
  const galleryEv = gallery
    ? webEv(gallery, `Podstránka „${gallery.title ?? gallery.url}“ s ${gallery.imageCount} obrázkami.`)
    : webEv(home, `Na webe sme nenašli odkaz na galériu / realizácie / referencie. Úvod má ${home.imageCount} obrázkov.`);

  // Služby
  const services = byKind("services");
  const serviceItems = (services?.headings.length ? services.headings : home.headings).slice(0, 6);
  const servicesClear = !!services || home.headings.length >= 3;
  const servicesEv = services
    ? webEv(services, `Podstránka služieb: ${serviceItems.slice(0, 4).join(" · ") || services.title}`)
    : webEv(
        home,
        home.headings.length
          ? `Nadpisy na úvode: ${home.headings.slice(0, 5).join(" · ")}`
          : "Na úvodnej stránke nie sú nadpisy sekcií so službami.",
      );

  // Lokalita
  const city = company.city?.trim();
  const cityPage = city ? pages.find((p) => p.text.toLowerCase().includes(city.toLowerCase())) : null;
  const cityEv = city
    ? cityPage
      ? webEv(cityPage, `Web spomína lokalitu „${city}“.`)
      : webEv(home, `Na načítaných stránkach sme nenašli zmienku o meste „${city}“.`)
    : null;

  // Otváracie hodiny, sociálne siete
  const hours = pages.find((p) => p.hasOpeningHours);
  const hoursEv = hours ? webEv(hours, "Na webe sú uvedené otváracie hodiny / pracovné dni.") : null;
  const socialLinks = [...new Set(pages.flatMap((p) => p.socialLinks))];
  const socialEv = socialLinks.length ? webEv(home, `Odkazy na profily: ${socialLinks.join(", ")}`) : null;

  // História, referencie
  let historyText: string | null = null;
  let historyPage: PageFacts | null = null;
  for (const p of pages) {
    const m = p.text.match(/(od roku (?:19|20)\d{2}|(?:viac ako |už |takmer )?\d{1,2} rok(?:ov|y) (?:skúseností|na trhu|praxe|pôsobíme|pôsobenia))/i);
    if (m) {
      historyText = m[0];
      historyPage = p;
      break;
    }
  }
  const historyEv = historyPage && historyText ? webEv(historyPage, `„…${historyText}…“`) : null;
  const refPage = pages.find((p) => /referenc|recenzi|hodnoten|spokojn[ií] z[aá]kazn/i.test(p.text));
  const refEv = refPage ? webEv(refPage, "Web obsahuje referencie / hodnotenia zákazníkov.") : null;

  const year = home.copyrightYear;
  const yearEv = year ? webEv(home, `V pätičke je uvedené © ${year}.`) : null;
  const httpsEv = webEv(home, site.https ? "Web beží na https." : "Web beží bez https (nezabezpečené pripojenie).");

  const signals: Signals = {
    hasWebsite: true,
    siteOk: true,
    readable: !home.jsRendered,
    siteError: null,
    mobileViewport: sig(home.hasViewport, viewportEv),
    https: sig(site.https, httpsEv),
    phoneFound: sig(found.length > 0, phoneEv),
    phoneMatchesLead: sig(!!match, matchEv),
    phoneClickable: sig(allTel.length > 0, telEv),
    phoneLowOnPage: sig(!!lowEv, lowEv),
    emailFound: sig(!!mail, mailEv),
    contactForm: sig(!!form, formEv),
    galleryPage: { ...sig(!!gallery, galleryEv), images: gallery?.imageCount ?? 0, url: gallery?.url ?? null },
    homeImages: home.imageCount,
    servicesClear: { ...sig(servicesClear, servicesEv), items: serviceItems },
    cityMentioned: sig(!!cityPage, cityEv),
    openingHours: sig(!!hours, hoursEv),
    social: { ...sig(socialLinks.length > 0, socialEv), links: socialLinks },
    history: { ...sig(!!historyText, historyEv), text: historyText },
    references: sig(!!refPage, refEv),
    copyrightYear: { ...sig(!!year, yearEv), year },
    h1: home.h1[0] ?? null,
    isGalleryVertical: cat.gallery,
  };
  return { evidence, signals };
}

function emptySignals(hasWebsite: boolean, error: string | null, galleryVertical: boolean): Signals {
  const no = (): Signal => ({ value: false, evidence: [] });
  return {
    hasWebsite,
    siteOk: false,
    readable: false,
    siteError: error,
    mobileViewport: no(),
    https: no(),
    phoneFound: no(),
    phoneMatchesLead: no(),
    phoneClickable: no(),
    phoneLowOnPage: no(),
    emailFound: no(),
    contactForm: no(),
    galleryPage: { ...no(), images: 0, url: null },
    homeImages: 0,
    servicesClear: { ...no(), items: [] },
    cityMentioned: no(),
    openingHours: no(),
    social: { ...no(), links: [] },
    history: { ...no(), text: null },
    references: no(),
    copyrightYear: { ...no(), year: null },
    h1: null,
    isGalleryVertical: galleryVertical,
  };
}

/** Evidence id pre „web chýba / nefunguje“ — prvý web/manual záznam o stave webu. */
export function siteStateEvidence(evidence: Evidence[]): string[] {
  const e = evidence.find((x) => /vlastný web|nenačítal|neodpovedá|chybu HTTP|nepodarilo načítať/i.test(x.excerpt));
  return e ? [e.id] : [];
}
