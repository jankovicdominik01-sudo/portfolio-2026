/**
 * Podklady pre volajúceho: krátky prirodzený scenár bez klamstva.
 *
 *  1. opener         — kto volá (pravé meno), žiadna vymyslená identita ani „prieskum“
 *  2. otázka         — jedna prirodzená otázka k ich podnikaniu (úprimná, nie „som zákazník“)
 *  3. prechod k webu — IBA to, čo máme overené; pri neistote otázka namiesto tvrdenia
 *  4. Dominik        — hotový web, pôvodný klient ho neprevzal (iba ak ponuka sedí na segment)
 *  5. súhlas         — „Mohol by sa vám ozvať?“
 */
import { categoryOf, type CategoryId, type Company, type Lead, type Offer } from "./types";
import { ISSUE_LABEL, offerFit } from "./score";

export type Speech = "f" | "m";
/** Tvar slovesa podľa nastavenia volajúceho; bez nastavenia neutrálne „pozeral(a)“. */
const v = (s: Speech | undefined, f: string, m: string) => (s === "f" ? f : s === "m" ? m : `${m}(a)`);

/** Úprimné otázky k podnikaniu — Soňa sa pýta, lebo ju to zaujíma, netvári sa ako zákazníčka. */
export const SEGMENT_QUESTIONS: Record<CategoryId, string[]> = {
  zahradnictvo: [
    "Robíte aj zakladanie a údržbu trávnikov, alebo skôr predaj rastlín?",
    "Čo by ste teraz na jeseň odporučili ľuďom urobiť v záhrade?",
  ],
  stolarstvo: ["Robíte skôr kuchyne na mieru, alebo aj iný nábytok?", "Koľko dopredu máte teraz plno?"],
  kovovyroba: ["Robíte skôr zábradlia a brány, alebo aj väčšie konštrukcie?"],
  "brany-ploty": ["Robíte aj automatické brány, alebo skôr klasické ploty?"],
  murari: ["Robíte skôr novostavby, alebo rekonštrukcie?"],
  tesari: ["Robíte skôr krovy, alebo aj pergoly a prístrešky?"],
  strechy: ["Robíte skôr nové strechy, alebo aj opravy a klampiarinu?"],
  vodoinstalater: ["Robíte aj havarijné opravy, alebo skôr kompletné rozvody?"],
  elektrikar: ["Robíte skôr nové rozvody, alebo aj revízie a opravy?"],
  podlahy: ["Robíte skôr drevené podlahy, alebo aj vinyl a laminát?"],
  obklady: ["Robíte skôr kúpeľne, alebo aj veľké plochy?"],
  kominarstvo: ["Robíte aj revízie komínov, alebo skôr čistenie?"],
  ine: ["Čomu sa teraz najviac venujete?"],
};

export type CallCard = {
  why: string;
  verified: string | null;
  opener: string;
  questions: string[];
  transition: string;
  dominik: string;
  consent_question: string;
  /** Na čo si dať pozor — vždy aspoň pravidlá úprimnosti. */
  cautions: string[];
  /** Overený stav webu? Ak nie, prechod je formulovaný ako otázka. */
  web_verified: boolean;
  /** Pravdivá odpoveď na „Odkiaľ máte moje číslo?“ */
  source_answer: string;
};

const SOURCE_NAME: Record<string, string> = {
  azet: "z verejného katalógu firiem na azet.sk",
  zoznam: "z verejného katalógu firiem na zoznam.sk",
  zlatestranky: "zo Zlatých stránok",
  bazos: "z vášho inzerátu na Bazoši",
  google: "z vášho profilu na Google Mapách",
};

export function sourceAnswer(company: Pick<Company, "sources">, sourceUrl: string | null): string {
  const s = company.sources?.[0]?.source ?? (/azet\.sk/.test(sourceUrl ?? "") ? "azet" : /zoznam\.sk/.test(sourceUrl ?? "") ? "zoznam" : /bazos\.sk/.test(sourceUrl ?? "") ? "bazos" : /zlatestranky/.test(sourceUrl ?? "") ? "zlatestranky" : null);
  return `Máme ho ${s ? SOURCE_NAME[s] ?? "z verejne dostupného firemného kontaktu" : "z verejne dostupného firemného kontaktu"}.`;
}

const DAY = 86_400_000;

function verifiedLabel(at: string | null | undefined, nowIso: string): string | null {
  if (!at) return null;
  const days = Math.floor((new Date(nowIso).getTime() - new Date(at).getTime()) / DAY);
  if (days <= 0) return "Kontrolované dnes";
  if (days === 1) return "Kontrolované včera";
  return `Kontrolované pred ${days} dňami`;
}

/** Stav webu je dostatočne overený na tvrdenie (nie na otázku)? */
export function webClaimAllowed(lead: Pick<Lead, "website_status" | "website_checked_at">, nowIso: string): boolean {
  if (!lead.website_status || lead.website_status === "uncertain" || lead.website_status === "working") return false;
  if (!lead.website_checked_at) return false;
  // Starší údaj než 14 dní už netvrdíme — web mohol medzitým ožiť.
  return new Date(nowIso).getTime() - new Date(lead.website_checked_at).getTime() <= 14 * DAY;
}

export function buildCallCard(opts: {
  lead: Lead;
  company: Company;
  callerName: string;
  speech: Speech | undefined;
  offers: Offer[];
  nowIso: string;
}): CallCard {
  const { lead, company, callerName, speech: s, offers, nowIso } = opts;
  const cat = categoryOf(company.category);
  const issue = lead.website_issue ?? "";
  const claim = webClaimAllowed(lead, nowIso);
  const fit = offerFit(company.category, offers);

  const why = claim
    ? lead.website_status === "no_website"
      ? "Vlastný web sme k nim nenašli (katalóg ani vyhľadávanie)."
      : `Ich web: ${ISSUE_LABEL[issue] ?? (lead.website_status === "broken" ? "nefunguje" : "má viditeľné problémy")}.`
    : (lead.call_brief?.main_idea ?? lead.analysis?.primary_hook ?? "Firma bez overeného dôvodu — pýtaj sa, netvrď.");

  let transition: string;
  if (!claim) {
    transition = `${v(s, "Pozerala", "Pozeral")} som si vás na internete a nie som si ${v(s, "istá", "istý")}, či máte aktuálnu stránku — máte nejakú?`;
  } else if (lead.website_status === "no_website") {
    transition = `${v(s, "Hľadala", "Hľadal")} som si vás na internete a vlastnú stránku som ${v(s, "nenašla", "nenašiel")} — máte nejakú?`;
  } else if (lead.website_status === "broken") {
    transition = `${v(s, "Pozerala", "Pozeral")} som si vás a ${v(s, "všimla", "všimol")} som si, že vám stránka momentálne nefunguje${
      ISSUE_LABEL[issue] ? ` (${ISSUE_LABEL[issue]})` : ""
    }.`;
  } else {
    const obs = lead.call_brief?.observation;
    transition = obs
      ? obs
      : `${v(s, "Pozerala", "Pozeral")} som si vašu stránku a na mobile sa mi zle čítala.`;
  }

  const dominik =
    fit === "fits"
      ? "Mám kamaráta, ktorý robí weby. Teraz mu zostal jeden hotový, pretože pôvodný klient ho nakoniec neprevzal. Možno by sa vám dal prispôsobiť."
      : "Mám kamaráta, ktorý robí weby pre menšie firmy.";

  const cautions = [
    "Nevydávaj sa za zákazníka ani za prieskum — ak sa spýtajú, prečo voláš, povedz rovno, že kvôli ich stránke.",
    "Súhlas s kontaktom ≠ záujem. Nepíš „má záujem“, ak iba dovolil, nech sa Dominik ozve.",
    "Nehovor, že im ujdú zákazníci, že je web nebezpečný, ani že ponuka platí len dnes.",
    "Ak povedia, že nechcú, aby ste volali: poďakuj, ukonči a zapíš „Nevolať znova“ — firma sa už nikdy nevráti.",
  ];
  if (!claim) cautions.unshift("Stav webu nie je 100 % overený — NEHOVOR, že web nefunguje alebo že ho nemajú. Iba sa spýtaj.");
  if (fit !== "fits") cautions.push("Nespomínaj hotový web ani cenu — pre tento segment ho nemáme.");
  if (lead.business_check === "uncertain") cautions.push("Nie je isté, čo presne firma dnes robí — najprv sa opýtaj.");

  return {
    why,
    verified: verifiedLabel(lead.website_checked_at, nowIso),
    opener: `Dobrý deň, volám sa ${callerName}. Mám na vás krátku otázku.`,
    questions: SEGMENT_QUESTIONS[cat.id].slice(0, 2),
    transition,
    dominik,
    consent_question: "Mohol by sa vám o tom ozvať?",
    cautions,
    web_verified: claim,
    source_answer: sourceAnswer(company, lead.source_url),
  };
}

/** Frázy, ktoré v scenári nesmú byť nikdy (klamstvo / nepodložené tvrdenie / nátlak). */
export const FORBIDDEN_CLAIMS: { re: RegExp; why: string }[] = [
  { re: /prieskum/i, why: "vymyslený prieskum" },
  { re: /prich[aá]dzate o|str[aá]cate z[aá]kazn/i, why: "nepodložené straty zákazníkov" },
  { re: /nebezpečn/i, why: "strašenie bezpečnosťou" },
  { re: /(len|iba) dnes|posledn[aá] šanca/i, why: "falošná urgentnosť" },
  { re: /m[aá]te z[aá]ujem/i, why: "súhlas nie je záujem" },
  { re: /presne pre v[aá]s/i, why: "web nebol robený pre nich" },
];

export function forbiddenClaims(texts: (string | null | undefined)[]): string[] {
  const hay = texts.filter(Boolean).join(" \n ");
  return FORBIDDEN_CLAIMS.filter((f) => f.re.test(hay)).map((f) => f.why);
}

/** „Nemáte web“ / „web nefunguje“ smie zaznieť iba pri overenom stave. */
export function unverifiedWebClaim(texts: (string | null | undefined)[], webVerified: boolean): boolean {
  if (webVerified) return false;
  return /nem[aá]te (web|str[aá]nk)|(web|str[aá]nka) (v[aá]m )?nefunguje/i.test(texts.filter(Boolean).join(" "));
}

/** Dominikov warm opening — pravdivý, súhlas nepovyšuje na záujem. Tvar slovies podľa nastavenia volajúceho. */
export function dominikOpening2(opts: { adminName: string; lead: Lead; callerSpeech?: Speech }): string[] {
  const c = opts.lead.consent;
  const first = opts.adminName.split(" ")[0];
  if (!c) return [`Dobrý deň, tu ${first}.`];
  const sp = opts.callerSpeech;
  const g = (f: string, m: string) => (sp === "f" ? f : sp === "m" ? m : `${m}(a)`);
  const lines = [
    `Dobrý deň, tu ${first}. ${c.by_name} mi na vás ${g("posunula", "posunul")} kontakt.`,
    c.kind === "info"
      ? `${g("Spomínala", "Spomínal")}, že by ste chceli viac informácií o stránke, tak sa ozývam.`
      : `${g("Spomínala", "Spomínal")}, že ste sa bavili aj o vašej stránke a súhlasili ste, že sa vám môžem ozvať.`,
  ];
  return lines;
}
