import "server-only";
import type { Analysis, CallBrief, Claim, Company, Evidence, Offer } from "../types";
import { categoryOf } from "../types";
import { siteStateEvidence, type Signals } from "./signals";
import {
  CALL_GOAL,
  DOMINIK_INTRO,
  KEY_QUESTION,
  defaultObjections,
  matchOffer,
  offerLine,
  whatNotToSay,
} from "./brief";

/**
 * Deterministický analyzátor (bez AI kľúča). Pracuje iba so signálmi,
 * ktoré majú evidence — nič si nevymýšľa. Keď nič nenájde, povie to.
 */

type Finding = {
  /** 3 = silný obchodný dôvod, 2 = dobrý, 1 = drobnosť */
  strength: 1 | 2 | 3;
  text: string; // pozorovanie pre Dominika (fakt, nie verdikt)
  spoken: string; // ako to povie kamarát
  reason: string; // prečo je to relevantné pre zákazníka firmy
  fix: string; // čo s tým Dominik jednoducho spraví
  evidence: string[];
};

type Positive = { text: string; spoken: string; evidence: string[]; weight: number };

function positives(s: Signals, company: Company): Positive[] {
  const out: Positive[] = [];
  if (s.galleryPage.value && s.galleryPage.images >= 6)
    out.push({
      text: `Majú samostatnú galériu realizácií (${s.galleryPage.images} fotiek) — je vidno, že majú čo ukázať.`,
      spoken: "máte fakt veľa pekných realizácií",
      evidence: s.galleryPage.evidence,
      weight: s.isGalleryVertical ? 5 : 3,
    });
  if (s.history.value && s.history.text)
    out.push({
      text: `Na webe uvádzajú dlhoročné pôsobenie („${s.history.text}“).`,
      spoken: "fungujete už pekných pár rokov",
      evidence: s.history.evidence,
      weight: 4,
    });
  if (s.references.value)
    out.push({
      text: "Na webe majú referencie / hodnotenia od zákazníkov.",
      spoken: "máte aj pekné referencie od zákazníkov",
      evidence: s.references.evidence,
      weight: 3,
    });
  if (s.servicesClear.value && s.servicesClear.items.length >= 3)
    out.push({
      text: `Majú jasne pomenované služby (${s.servicesClear.items.slice(0, 3).join(", ")}).`,
      spoken: "máte široký záber služieb",
      evidence: s.servicesClear.evidence,
      weight: 2,
    });
  if (s.social.value)
    out.push({
      text: "Majú prepojené profily na sociálnych sieťach.",
      spoken: "vidno, že ste aktívni aj na sociálnych sieťach",
      evidence: s.social.evidence,
      weight: 1,
    });
  if (s.cityMentioned.value && company.city)
    out.push({
      text: `Jasne sa hlásia k lokalite ${company.city}.`,
      spoken: `ste tu v ${company.city} známa firma`,
      evidence: s.cityMentioned.evidence,
      weight: 1,
    });
  return out.sort((a, b) => b.weight - a.weight);
}

function findings(s: Signals, company: Company, evidence: Evidence[]): Finding[] {
  const out: Finding[] = [];
  const cat = categoryOf(company.category);

  if (!s.hasWebsite) {
    out.push({
      strength: 3,
      text: "Firma nemá vlastný web — k dispozícii je iba kontakt zo zdroja leadu.",
      spoken: "vás človek na internete v podstate nenájde inak než cez katalóg",
      reason: "Kto hľadá firmu na Googli, nemá kde vidieť ich prácu ani služby a zavolá niekomu, koho nájde.",
      fix: "Jednoduchý web s realizáciami, službami a telefónom na jedno ťuknutie.",
      evidence: siteStateEvidence(evidence),
    });
    return out;
  }
  if (!s.siteOk) {
    out.push({
      strength: 3,
      text: `Web sa pri kontrole nenačítal (${s.siteError ?? "chyba"}).`,
      spoken: "sa mi vaša stránka nechcela načítať",
      reason: "Ak sa stránka nenačíta ani zákazníkovi, odíde ku konkurencii.",
      fix: "Overiť, či web beží; ak nie, spraviť nový jednoduchý web.",
      evidence: siteStateEvidence(evidence),
    });
    return out;
  }
  if (!s.readable) {
    // Obsah sme nevideli — nič o ňom netvrdíme. Iba to, čo je isté z hlavičky stránky.
    if (!s.mobileViewport.value)
      out.push({
        strength: 3,
        text: "Na mobile sa stránka zobrazuje ako zmenšená verzia počítačovej stránky — text treba zväčšovať prstami.",
        spoken: "na mobile sa mi web zobrazil taký zmenšený a musel som si ho zväčšovať",
        reason: "Väčšina ľudí hľadá remeselníka z mobilu. Keď musia zväčšovať, často to vzdajú.",
        fix: "Web, ktorý sa na mobile zobrazí normálne a čitateľne.",
        evidence: s.mobileViewport.evidence,
      });
    return out;
  }
  if (!s.mobileViewport.value)
    out.push({
      strength: 3,
      text: "Na mobile sa stránka zobrazuje ako zmenšená verzia počítačovej stránky — text treba zväčšovať prstami.",
      spoken: "na mobile sa mi web zobrazil taký zmenšený a musel som si ho zväčšovať",
      reason: "Väčšina ľudí hľadá remeselníka z mobilu. Keď musia zväčšovať, často to vzdajú.",
      fix: "Web, ktorý sa na mobile zobrazí normálne a čitateľne.",
      evidence: s.mobileViewport.evidence,
    });
  if (cat.gallery && !s.galleryPage.value && s.homeImages < 6)
    out.push({
      strength: 3,
      text: "Na webe sme nenašli galériu realizácií ani referencie s fotkami.",
      spoken: "som na stránke nenašiel fotky vašich realizácií",
      reason: `V segmente ${cat.label.toLowerCase()} sa zákazník rozhoduje hlavne podľa toho, čo firma už spravila.`,
      fix: "Prehľadná galéria realizácií hneď na úvodnej stránke.",
      evidence: s.galleryPage.evidence,
    });
  if (!s.phoneFound.value)
    out.push({
      strength: 3,
      text: "Na úvodnej stránke ani v kontakte sme nenašli telefónne číslo.",
      spoken: "som na stránke chvíľu hľadal vaše číslo",
      reason: "Remeselníkovi ľudia najčastejšie volajú — keď číslo nenájdu hneď, zavolajú inam.",
      fix: "Telefón viditeľne hore a tlačidlo „Zavolať“ na mobile.",
      evidence: s.phoneFound.evidence,
    });
  else if (!s.phoneClickable.value)
    out.push({
      strength: 2,
      text: "Telefón je na webe uvedený iba ako text — na mobile sa naň nedá ťuknúť a rovno zavolať.",
      spoken: "keď som vám chcel z mobilu zavolať, musel som si číslo prepisovať",
      reason: "Každý krok navyše znamená, že časť ľudí nezavolá.",
      fix: "Klikateľné číslo a tlačidlo „Zavolať“.",
      evidence: s.phoneClickable.evidence,
    });
  else if (s.phoneLowOnPage.value)
    out.push({
      strength: 2,
      text: "Telefón je na úvodnej stránke až úplne dole.",
      spoken: "kontakt som našiel až úplne dole na stránke",
      reason: "Kto chce zavolať, nechce scrollovať celú stránku.",
      fix: "Kontakt viditeľne v hornej časti.",
      evidence: s.phoneLowOnPage.evidence,
    });
  if (!s.servicesClear.value)
    out.push({
      strength: 2,
      text: "Na úvodnej stránke nie je hneď vidieť, aké služby firma ponúka.",
      spoken: "som z úvodnej stránky hneď nepochopil, čo všetko robíte",
      reason: "Návštevník by mal do pár sekúnd vedieť, či mu firma vie pomôcť.",
      fix: "Jasný zoznam služieb hneď na úvode.",
      evidence: s.servicesClear.evidence,
    });
  if (company.city && !s.cityMentioned.value)
    out.push({
      strength: 1,
      text: `Na webe nie je jasne napísané, že firma pôsobí v ${company.city} a okolí.`,
      spoken: "nebolo mi jasné, kde všade pôsobíte",
      reason: "Zákazník chce vedieť, či firma príde aj k nemu.",
      fix: "Uviesť mestá a okolie, kde firma robí.",
      evidence: s.cityMentioned.evidence,
    });
  const year = s.copyrightYear.year;
  if (year && year <= new Date().getFullYear() - 4)
    out.push({
      strength: 1,
      text: `V pätičke je © ${year} — návštevník môže mať pocit, že sa web dlho neaktualizoval.`,
      spoken: "vyzerá to, že stránku už dlhšie nikto neaktualizoval",
      reason: "Pri remeselníkovi to môže vyvolať otázku, či ešte funguje.",
      fix: "Aktuálny obsah a fotky.",
      evidence: s.copyrightYear.evidence,
    });
  if (!s.https.value)
    out.push({
      strength: 1,
      text: "Web nemá zabezpečené pripojenie — prehliadač môže ukazovať „Nezabezpečené“.",
      spoken: "prehliadač mi pri vašej stránke písal, že nie je zabezpečená",
      reason: "Varovanie v prehliadači znižuje dôveru.",
      fix: "Zabezpečené pripojenie (https).",
      evidence: s.https.evidence,
    });
  if (!s.emailFound.value && !s.contactForm.value)
    out.push({
      strength: 1,
      text: "Na webe nie je e-mail ani kontaktný formulár — jediná možnosť je telefón.",
      spoken: "nedá sa vám tam napísať ani poslať dopyt",
      reason: "Časť ľudí večer nevolá, ale rada pošle správu.",
      fix: "Jednoduchý formulár na dopyt.",
      evidence: s.contactForm.evidence,
    });
  return out.sort((a, b) => b.strength - a.strength);
}

export function analyzeWithRules(input: {
  company: Company;
  signals: Signals;
  evidence: Evidence[];
  offers: Offer[];
}): { analysis: Analysis; brief: CallBrief } {
  const { company, signals: s, evidence, offers } = input;
  const cat = categoryOf(company.category);
  const pos = positives(s, company);
  const fnd = findings(s, company, evidence);
  const main = fnd[0] ?? null;
  const second = fnd[1] ?? null;
  const nothingFound = !main || main.strength < 2;
  const offer = matchOffer(offers, company.category);

  const claim = (text: string, ev: string[]): Claim => ({ text, evidence_ids: ev });
  const praise = pos[0];
  const praiseSpoken = praise ? `Pozeral som si vás a ${praise.spoken}.` : "Pozeral som si vaše stránky.";

  const hook = main
    ? `${praise ? `${capitalize(praise.spoken)}, len` : "Len"} som si všimol, že ${main.spoken}.`
    : null;
  const hook2 = second ? `Ešte som si všimol, že ${second.spoken}.` : null;

  const warnings: string[] = [];
  if (!praise) warnings.push("Nenašli sme konkrétnu vec na pochválenie — doplň ju ručne po pozretí webu.");
  if (nothingFound) warnings.push("Nenašli sme výrazný problém. Lead nie je urgentný — zváž vyradenie.");
  if (s.siteOk && !s.readable)
    warnings.push("Obsah webu sa nedal automaticky prečítať (JavaScript). Pozri si web ručne — o obsahu nič netvrdíme.");
  if (!s.phoneMatchesLead.value && company.phone && s.siteOk && s.readable)
    warnings.push("Telefón z leadu sme na webe nenašli — pred volaním over číslo.");

  const summaryParts = [
    `${company.name} — ${cat.label.toLowerCase()}${company.city ? `, ${company.city}` : ""}.`,
    s.h1 ? `Web sa predstavuje nadpisom „${s.h1}“.` : null,
    !s.hasWebsite ? "Vlastný web sme nenašli." : null,
    s.servicesClear.items.length ? `Na webe uvádzajú: ${s.servicesClear.items.slice(0, 4).join(", ")}.` : null,
  ];

  const analysis: Analysis = {
    engine: "rules",
    model: null,
    analyzed_at: new Date().toISOString(),
    company_summary: summaryParts.filter(Boolean).join(" "),
    why_this_lead: main
      ? `${cat.label} je náš segment${praise ? `, firma má čo ukázať (${lowerFirst(praise.text)})` : ""} a našli sme konkrétnu vec: ${lowerFirst(main.text)}`
      : "Firma je v našom segmente, ale nenašli sme výrazný konkrétny dôvod na kontakt.",
    positive_points: pos.slice(0, 4).map((p) => claim(p.text, p.evidence)),
    observations: fnd.slice(0, 4).map((f) => claim(f.text, f.evidence)),
    customer_risk: main?.reason ?? null,
    customer_gap: main ? `Zákazník firmy: ${main.reason}` : null,
    opportunity: main?.fix ?? null,
    primary_hook: hook,
    secondary_hook: hook2,
    nothing_found: nothingFound,
    confidence: s.siteOk ? (main && main.evidence.length ? "medium" : "low") : s.hasWebsite ? "low" : "medium",
    evidence,
    warnings,
  };

  const brief: CallBrief = {
    praise: praise?.text ?? "Nenájdené — pozri si web a doplň jednu konkrétnu pochvalu.",
    observation: main?.text ?? "Nenájdený výrazný problém.",
    reason: main?.reason ?? "—",
    opportunity: main?.fix ?? "—",
    main_idea: main
      ? `${praise ? capitalize(praise.spoken) : "Firma je v našom segmente"}, ale ${lowerFirst(stripDot(main.text))}.`
      : "Nemáme silný dôvod volať — lead zváž vyradiť.",
    call_opening: "Dobrý deň, môžem sa vás na niečo spýtať? Pozeral som si teraz vaše stránky kvôli jednej veci…",
    natural_pitch: [praiseSpoken, main ? `Len som si všimol jednu vec — ${main.spoken}.` : null, main?.reason ?? null]
      .filter(Boolean)
      .join(" "),
    dominik_intro: DOMINIK_INTRO,
    offer: offer ? offerLine(offer) : null,
    offer_id: offer?.id ?? null,
    estimated_price: offer?.estimated_price ?? null,
    key_question: KEY_QUESTION,
    goal: CALL_GOAL,
    remember: praise ? `Pochváliť: ${lowerFirst(stripDot(praise.text))}.` : "Najprv sa normálne porozprávaj, až potom Dominik.",
    what_not_to_say: whatNotToSay(company.category, !!offer),
    objections: defaultObjections(!!offer, offer?.estimated_price ?? null),
  };

  return { analysis, brief };
}

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);
const stripDot = (s: string) => s.trim().replace(/[.!…]+$/, "");
