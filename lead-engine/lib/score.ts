/**
 * Priority score — pravidlá, nie AI. Každý faktor má kľúč (pre analytiku / learning loop),
 * ľudský popis a body. Váhy sú v jednej tabuľke, aby sa dali neskôr kalibrovať podľa reálnych
 * výsledkov (Analytika → „Faktory skóre vs. súhlasy“).
 */
import { categoryOf, type Company, type Lead, type Offer, type Priority, type Score } from "./types";

export const SCORE_VERSION = 1;

/** Váhy v1. Zmena váh = zvýš SCORE_VERSION. */
export const WEIGHTS = {
  web_down: 30, // web nefunguje: parked, db error, zlý certifikát, cudzí redirect, doména neexistuje, 5xx
  web_visible_error: 20, // web beží, ale zjavná chyba: PHP hláška, frameset, „vo výstavbe“
  web_weak: 12, // slabý web (mobil, https…)
  no_web_verified: 15, // bez webu, overené vyhľadávaním
  web_working: -30, // web funguje → slabý dôvod volať
  web_uncertain: -10, // stav webu nie je istý
  register_ok: 15, // aktívna firma v registri
  business_changed: -40, // odbor sa zmenil
  business_uncertain: -10,
  phone_on_web: 10, // telefón overený na ich webe
  phone_catalog_only: 0, // iba z katalógu (riziko)
  mobile: 5, // mobil = často priamo majiteľ
  service_segment: 10, // služba, ktorú zákazníci hľadajú online
  unknown_segment: -5,
  offer_fits: 15, // hotový web sa dá prispôsobiť tomuto segmentu
  offer_unknown: -5,
  multi_source: 5, // firma vo viacerých zdrojoch
} as const;

export const BANDS = { high: 60, medium: 35 } as const;

const DOWN = new Set(["parked", "db_error", "bad_cert", "foreign_redirect", "domain_dead", "http_error", "server_error"]);
const VISIBLE = new Set(["php_error", "frames", "construction", "empty"]);

export type ScoreInput = {
  company: Pick<Company, "category" | "phone" | "ico" | "sources">;
  website_status: Lead["website_status"];
  website_issue: string | null | undefined;
  business_check: Lead["business_check"];
  register_ok: boolean;
  phone_on_web: boolean;
  offers: Offer[];
};

export function offerFit(category: string, offers: Offer[]): Score["offer_fit"] {
  if (offers.some((o) => o.available && o.category === category)) return "fits";
  return offers.some((o) => o.available) ? "no_fit" : "unknown";
}

const isMobile = (p: string | null) => !!p && /^(\+?421|0)\s?9/.test(p.replace(/[^\d+]/g, "").replace(/^00/, "+"));

export function computeScore(i: ScoreInput): Score {
  const factors: Score["factors"] = [];
  const risks: Score["risks"] = [];
  const f = (key: keyof typeof WEIGHTS, label: string) => factors.push({ key, label, points: WEIGHTS[key] });
  const r = (key: keyof typeof WEIGHTS, label: string) => risks.push({ key, label, points: WEIGHTS[key] });

  const issue = i.website_issue ?? "";
  switch (i.website_status) {
    case "broken":
      if (DOWN.has(issue)) f("web_down", `Web nefunguje (${ISSUE_LABEL[issue] ?? issue})`);
      else f("web_visible_error", `Web má zjavnú chybu${issue ? ` (${ISSUE_LABEL[issue] ?? issue})` : ""}`);
      break;
    case "weak":
      if (VISIBLE.has(issue)) f("web_visible_error", `Na webe je zjavná chyba (${ISSUE_LABEL[issue] ?? issue})`);
      else f("web_weak", "Slabý web (mobil / zabezpečenie)");
      break;
    case "no_website":
      f("no_web_verified", "Vlastný web sme nenašli ani vyhľadávaním");
      break;
    case "working":
      r("web_working", "Web funguje — slabší dôvod volať");
      break;
    default:
      r("web_uncertain", "Stav webu nie je 100 % overený");
  }

  if (i.business_check === "changed") r("business_changed", "Firma dnes zrejme robí iný odbor");
  else if (i.business_check === "uncertain") r("business_uncertain", "Nejasný odbor");
  if (i.register_ok) f("register_ok", "Firma je aktívna v registri");

  if (i.phone_on_web) f("phone_on_web", "Telefón overený na ich webe");
  else if (i.company.phone) r("phone_catalog_only", "Telefón iba z katalógu — môže byť starý");
  if (isMobile(i.company.phone)) f("mobile", "Mobil — pravdepodobne priamo majiteľ");

  const cat = categoryOf(i.company.category);
  if (cat.id === "ine") r("unknown_segment", "Nejasný segment");
  else f("service_segment", `${cat.label} — zákazníci hľadajú firmu online`);

  const fit = offerFit(i.company.category, i.offers);
  if (fit === "fits") f("offer_fits", "Hotový web sa dá prispôsobiť tomuto segmentu");
  else r("offer_unknown", fit === "no_fit" ? "Hotový web je robený pre iný segment" : "Nevieme, či hotový web sedí");

  if ((i.company.sources?.length ?? 0) >= 2) f("multi_source", "Firma je vo viacerých katalógoch");

  const points = [...factors, ...risks].reduce((a, x) => a + x.points, 0);
  const band = points >= BANDS.high ? "high" : points >= BANDS.medium ? "medium" : "low";
  return { version: SCORE_VERSION, points, band, factors, risks, offer_fit: fit };
}

export function priorityFromScore(s: Score): Priority {
  return s.band === "high" ? "hot" : s.band === "medium" ? "ready" : "low";
}

export const ISSUE_LABEL: Record<string, string> = {
  parked: "prázdna stránka hostingu",
  db_error: "chyba databázy",
  bad_cert: "chybný certifikát",
  foreign_redirect: "presmeruje na cudzí web",
  domain_dead: "adresa neexistuje",
  http_error: "stránka vracia chybu",
  server_error: "chyba servera",
  php_error: "chybová hláška na stránke",
  frames: "web z 90. rokov, na mobile nepoužiteľný",
  construction: "„stránka vo výstavbe“",
  empty: "stránka bez obsahu",
  no_viewport: "nie je pre mobil",
  no_https: "bez zabezpečenia",
  old_copyright: "dlho neaktualizovaný",
  builder: "bezplatný stavebnicový web",
};
