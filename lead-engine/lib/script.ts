/**
 * Podklady pre volajúceho: krátky prirodzený scenár bez klamstva.
 *
 *  1. opener         — kto volá (pravé meno), žiadna vymyslená identita ani „prieskum“
 *  2. otázka         — jedna prirodzená otázka k ich podnikaniu (úprimná, nie „som zákazník“)
 *  3. prechod k webu — IBA to, čo máme overené; pri neistote otázka namiesto tvrdenia
 *  4. Dominik        — hotový web, pôvodný klient ho neprevzal (iba ak ponuka sedí na segment)
 *  5. súhlas         — „Mohol by sa vám ozvať?“
 */
import {
  categoryOf,
  DATA_QUALITY_LABEL,
  WEBSITE_RESOLUTION_LABEL,
  type CategoryId,
  type Company,
  type Lead,
  type Offer,
  type RadarProfile,
  type WebsiteResolution,
} from "./types";
import { ISSUE_LABEL, offerFit } from "./score";

export type Speech = "f" | "m";
/** Tvar slovesa podľa nastavenia volajúceho; bez nastavenia neutrálne „pozeral(a)“. */
const v = (s: Speech | undefined, f: string, m: string) => (s === "f" ? f : s === "m" ? m : `${m}(a)`);

/** Úprimné otázky k podnikaniu — Soňa sa pýta, lebo ju to zaujíma, netvári sa ako zákazníčka. */
export const SEGMENT_QUESTIONS: Partial<Record<CategoryId, string[]>> = {
  kadernictvo: ["Robíte skôr dámske strihy a farbenie, alebo aj pánske?", "Objednávajú sa k vám ľudia skôr cez telefón, alebo cez Instagram?"],
  barber: ["Robíte aj úpravu brady, alebo skôr strihy?", "Objednávajú sa k vám ľudia skôr cez telefón, alebo online?"],
  makeup: ["Robíte skôr svadobné líčenie, alebo aj bežné akcie?", "Kde vás ľudia najčastejšie nájdu — cez Instagram?"],
  nechty: ["Robíte skôr gél lak, alebo aj modeláž?", "Objednávajú sa k vám ľudia skôr cez správy na Instagrame?"],
  mihalnice: ["Robíte predlžovanie mihalníc aj úpravu obočia?", "Objednávajú sa k vám ľudia skôr cez Instagram?"],
  kozmetika: ["Ktoré ošetrenie si u vás ľudia pýtajú najčastejšie?", "Objednávajú sa k vám ľudia skôr telefonicky?"],
  fotograf: ["Fotíte skôr svadby, alebo aj rodinné a firemné fotenie?", "Kde vás klienti najčastejšie nájdu?"],
  video: ["Robíte skôr svadobné videá, alebo aj firemné?"],
  svadby: ["Robíte kompletnú organizáciu, alebo skôr výzdobu?"],
  reality: ["Robíte skôr predaj bytov, alebo aj domy a pozemky?", "Kde vás ľudia najčastejšie nájdu, keď predávajú?"],
  developer: ["Na aký projekt sa teraz najviac sústredíte?"],
  interier: ["Robíte skôr celé návrhy bytov, alebo aj jednotlivé miestnosti?"],
  architekt: ["Robíte skôr rodinné domy, alebo aj komerčné stavby?"],
  kuchyne: ["Robíte kuchyne celé na mieru, alebo aj z hotových dielcov?", "Koľko dopredu máte teraz plno?"],
  stavebnictvo: ["Robíte skôr rekonštrukcie, alebo aj novostavby?", "Koľko dopredu máte teraz plno?"],
  maliar: ["Robíte skôr byty, alebo aj fasády?"],
  fasady: ["Robíte aj zatepľovanie, alebo skôr samotné fasády?"],
  kurenie: ["Robíte skôr kotly, alebo aj tepelné čerpadlá?"],
  autoservis: ["Robíte skôr bežný servis, alebo aj väčšie opravy?"],
  pneuservis: ["Máte teraz v sezóne veľa prezúvania?"],
  detailing: ["Robíte skôr čistenie interiérov, alebo aj keramickú ochranu?"],
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
  /** Čo o firme VIEME a čo NEVIEME (Lead Radar). null pri starších leadoch bez profilu. */
  truth: TruthCard | null;
};

export type TruthCard = {
  category: { label: string; confidence: string; verified: boolean };
  phone: { value: string | null; confidence: string | null; sources: string[] };
  web: { status: WebsiteResolution; label: string; url: string | null; domain: string | null; issues: string[] };
  socials: { platform: string; url: string; label: string }[];
  does: { text: string; verified: boolean; sources: string[] };
  why_calling: string[];
  why_trust: string[];
  dont_say: string[];
  angle: string;
  data_quality: { tier: string; label: string; why: string[] };
  country: string;
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
export function webClaimAllowed(
  lead: Pick<Lead, "website_status" | "website_checked_at"> & { website_resolution?: Lead["website_resolution"] },
  nowIso: string,
): boolean {
  // Lead Radar: tvrdiť o webe smieme iba pri webe, ktorý firme POTVRDENE patrí.
  if (lead.website_resolution && lead.website_resolution !== "confirmed") return false;
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

  const prof = company.profile ?? null;
  const truth = prof ? truthCard(prof, lead, s, nowIso) : null;
  if (truth) transition = truth.angle;

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
  if (truth) for (const d of truth.dont_say) if (!cautions.includes(d)) cautions.unshift(d);
  cautions.push("Nesľubuj SEO, hosting, e-shop, reklamu, údržbu ani neobmedzené úpravy — obsah balíka povie Dominik.");

  return {
    why,
    verified: verifiedLabel(lead.website_checked_at, nowIso),
    opener: `Dobrý deň, volám sa ${callerName}. Mám na vás krátku otázku.`,
    questions: (SEGMENT_QUESTIONS[cat.id] ?? SEGMENT_QUESTIONS.ine ?? []).slice(0, 2),
    transition,
    dominik,
    consent_question: "Mohol by sa vám o tom ozvať?",
    cautions,
    web_verified: truth ? truth.web.status === "confirmed" && claim : claim,
    source_answer: sourceAnswer(company, lead.source_url),
    truth,
  };
}

/* ─────────────── Lead Radar: pravdivá karta ─────────────── */

const PLATFORM_LABEL: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", google: "Google" };
/** Objektívny problém webu → ľudská veta pre volajúceho (bez technických slov). */
const ISSUE_SPOKEN: Record<string, string> = {
  no_viewport: "na mobile sa mi zle čítala",
  no_portfolio: "nevidel(a) som tam vaše realizácie",
  no_cta: "nenašiel/nenašla som tam, ako sa u vás rýchlo objednať",
  old_copyright: "vyzerá, že sa dlhšie neaktualizovala",
  frames: "na mobile sa nedá poriadne používať",
  construction: "svieti na nej, že je vo výstavbe",
  phone_missing: "nie je na nej vaše aktuálne číslo",
  no_https: "prehliadač pri nej píše, že je nezabezpečená",
  slow: "načítavala sa dosť dlho",
};

export function truthCard(p: RadarProfile, lead: Pick<Lead, "website_checked_at">, s: Speech | undefined, nowIso: string): TruthCard {
  const cat = categoryOf(p.category?.id);
  const catVerified = ["high", "medium"].includes(p.category?.confidence ?? "");
  const res: WebsiteResolution = p.website?.status ?? p.website_resolution ?? "uncertain";
  const health = p.website?.health;
  const issues = (health?.issues ?? []).slice().sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
  const socials = (p.socials ?? [])
    .filter((x) => x.match === "confirmed" && x.url)
    .map((x) => ({ platform: x.platform, url: x.url as string, label: `${PLATFORM_LABEL[x.platform] ?? x.platform}${x.handle && !x.handle.includes("/") ? ` @${x.handle}` : ""}` }));
  const probs = p.commercial_problems ?? [];
  const has = (code: string) => probs.find((x) => x.code === code);
  const fresh = !lead.website_checked_at || new Date(nowIso).getTime() - new Date(lead.website_checked_at).getTime() <= 14 * DAY;
  const channels = [...new Set(socials.map((x) => PLATFORM_LABEL[x.platform] ?? x.platform))].join(" a ");

  let angle: string;
  if (res === "no_website_found" && socials.length) {
    // CASE A — social-first: netvrdíme „nemáte web“, pýtame sa (zároveň overí naše dáta)
    angle = `${v(s, "Pozerala", "Pozeral")} som si vašu prezentáciu a ${v(s, "našla", "našiel")} som vás hlavne cez ${channels}. Máte aj vlastnú stránku?`;
  } else if (res === "no_website_found") {
    angle = `${v(s, "Hľadala", "Hľadal")} som si vás na internete a vlastnú stránku som ${v(s, "nenašla", "nenašiel")} — máte nejakú?`;
  } else if (res === "confirmed" && health?.state === "broken" && fresh) {
    // CASE B — potvrdený nefunkčný web
    angle = `${v(s, "Pozerala", "Pozeral")} som si vašu stránku ${p.website?.domain ?? ""} a ${v(s, "všimla", "všimol")} som si, že momentálne nefunguje.`.replace("  ", " ");
  } else if (res === "confirmed" && has("SOCIAL_WEB_GAP") && fresh) {
    // CASE C — Instagram ukazuje prácu, web nie (objektívne: web nemá realizácie)
    angle = `Vaše práce na Instagrame vyzerajú fakt dobre — na stránke som ich ale ${v(s, "nenašla", "nenašiel")}. Nerozmýšľali ste to tam dať?`;
  } else if (res === "confirmed" && has("BRAND_WEBSITE_MISMATCH") && fresh) {
    angle = `Na Instagrame máte veľmi pekné fotky — stránka ich podľa mňa neukazuje až tak dobre. Nerozmýšľali ste ju osviežiť?`;
  } else if (res === "confirmed" && health?.state === "weak" && fresh) {
    const top = issues.find((x) => ISSUE_SPOKEN[x.key]);
    const said = top ? ISSUE_SPOKEN[top.key].replace("(a)", s === "f" ? "a" : s === "m" ? "" : "(a)").replace("nenašiel/nenašla", v(s, "nenašla", "nenašiel")) : "niečo by sa na nej dalo vylepšiť";
    angle = `${v(s, "Pozerala", "Pozeral")} som si vašu stránku a ${said}.`;
  } else if (res === "probable") {
    angle = `${v(s, "Pozerala", "Pozeral")} som si vás na internete — je stránka ${p.website?.domain ?? ""} vaša?`.replace("  ", " ");
  } else {
    angle = `${v(s, "Pozerala", "Pozeral")} som si vás na internete a nie som si ${v(s, "istá", "istý")}, či máte aktuálnu stránku — máte nejakú?`;
  }

  const dont: string[] = [];
  if (res === "confirmed" || res === "probable") dont.push(`Nehovor, že nemajú web — ${res === "confirmed" ? "majú potvrdený" : "pravdepodobne majú"} web ${p.website?.domain ?? ""}.`.replace("  ", " "));
  if (res === "no_website_found") dont.push("Nehovor „nemáte web“ — vieme iba, že sme ho nenašli. Opýtaj sa.");
  if (res === "uncertain") dont.push("Stav webu nie je istý — nič o webe netvrď, iba sa opýtaj.");
  if (res === "confirmed" && health?.state === "broken" && !fresh) dont.push("Kontrola webu je staršia ako 14 dní — netvrď, že nefunguje.");
  if (!catVerified) dont.push("Odbor nie je overený — najprv sa opýtaj, čo robia.");
  if (!p.description || p.description.confidence === "unknown") dont.push("Nevieme presne, čo robia — nič nepredpokladaj.");
  const ph = p.primary_phone;
  if (ph && ph.confidence !== "high") dont.push("Číslo je z jedného zdroja — na začiatku si over, že voláš správnej firme.");
  if (probs.some((x) => x.heuristic)) dont.push("Dojem z webu je názor, nie fakt — hovor „podľa mňa“, nikdy „máte zlý web“.");

  const trust = [...(p.identity?.evidence ?? []).slice(0, 3), ...(p.website?.evidence ?? []).slice(0, 2), ...socials.slice(0, 1).map((x) => `${x.label} patrí firme`)];
  return {
    category: { label: `${cat.emoji} ${cat.label}`, confidence: p.category?.confidence ?? "unknown", verified: catVerified },
    phone: { value: ph?.value ?? null, confidence: ph?.confidence ?? null, sources: ph?.sources ?? [] },
    web: {
      status: res,
      label: WEBSITE_RESOLUTION_LABEL[res],
      url: p.website?.url ?? null,
      domain: p.website?.domain ?? null,
      issues: issues.slice(0, 3).map((x) => x.text),
    },
    socials,
    does: p.description && p.description.confidence !== "unknown"
      ? { text: p.description.text, verified: true, sources: p.description.sources }
      : { text: "Presné zameranie sa nepodarilo spoľahlivo overiť.", verified: false, sources: [] },
    why_calling: probs.map((x) => x.label),
    why_trust: [...new Set(trust)].slice(0, 5),
    dont_say: dont,
    angle,
    data_quality: { tier: p.data_quality ?? "research", label: DATA_QUALITY_LABEL[p.data_quality ?? "research"], why: p.data_quality_why ?? [] },
    country: p.country,
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
