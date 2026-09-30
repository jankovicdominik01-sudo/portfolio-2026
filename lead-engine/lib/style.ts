/**
 * Dominik Style Engine: návrhy prvej správy a guard, ktorý ich pustí na schválenie.
 *
 * Nič sa tu neodosiela. Výstup je text na skopírovanie; odoslanie robí Dominik ručne
 * (provider, auto-send ani auto-reply nie sú schválené).
 *
 * Štýl: krátko, konkrétne, normálne. Správa hovorí o JEDNOM konkrétnom probléme,
 * ktorý sme videli (OBSERVED s úryvkom). Pochvala iba s evidence. Žiadne pomlčky (—, –),
 * namiesto nich tri bodky. E-mail bez diakritiky a bez „.sk“ v texte (Gmail obalí odkaz),
 * podpis „Jankovič“. SMS s diakritikou (bez nej vyzerá ako spam).
 */
import { findBannedPhrases } from "./ai/guard";
import type { Opportunity } from "./opportunity";
import { forbiddenClaims } from "./script";

export type DraftChannel = "EMAIL" | "SMS";
export type Draft = {
  channel: DraftChannel;
  variant: string;
  pain_code: string | null;
  cta: string;
  text: string;
  /** Pre SMS: počet segmentov. */
  sms_segments: number | null;
  issues: string[];
};

/** Tvoj zoznam z návrhu + agentúrne frázy. Nájdené = správa nejde na schválenie. */
export const STYLE_BANNED = [
  "radi by sme vám ponúkli",
  "posuňte svoje podnikanie",
  "posunieme vás",
  "na ďalšiu úroveň",
  "inovatívn",
  "revolučn",
  "online potenciál",
  "digitálna transformácia",
  "moderné weby",
  "robím moderné",
  "robíme webstránky",
  "na mieru vašim potrebám",
  "neváhajte ma kontaktovať",
];

/** Pochvaly, ktoré smú zaznieť iba s evidence (napr. recenzie z Google). */
const PRAISE = /\b(skvel|úžasn|krásn|perfektn|profesionáln|výborn|super)/i;

/** Prvá veta podľa toho, čo sme videli. Vždy „všimol som si“ / „nenašiel som“, nikdy „nemáte“. */
const PAIN: Record<string, string> = {
  phone_ordering: "všimol som si, že termíny riešite hlavne telefonicky",
  messenger_cta: "všimol som si, že zákazníkov posielate písať cez Messenger alebo WhatsApp",
  photos_by_message: "všimol som si, že fotky od zákazníkov chcete poslať správou",
  no_booking_found: "nenašiel som u vás online objednanie",
  no_form_found: "nenašiel som u vás formulár na dopyt",
};
const PAIN_ORDER = ["phone_ordering", "messenger_cta", "photos_by_message", "no_booking_found", "no_form_found"];

const IDEA: Record<string, string> = {
  service_booking: "Spravil som krátku ukážku, ako by vám chodila hotová požiadavka aj s autom, problémom a fotkami.",
  project_pipeline: "Spravil som krátku ukážku, ako by dopyt prišiel rovno s rozmermi a fotkami.",
  appointment: "Spravil som krátku ukážku, kde si klient sám vyberie čas a vám príde len potvrdenie.",
};

const CTA = "Ak by to dávalo zmysel, stačí odpísať.";
const SIGNATURE = "Jankovič";
/** Pätička pri studenom e-maile (buduje dôveru u cudzích). Portfólio bez „.sk“ nejde, preto je tu výnimka z guardu. */
export const EMAIL_FOOTER = ["--", "Dominik Jankovič  Web Developer & Designer", "Tel.: +421 945 456 973", "E-mail: jankovic.dominik01@gmail.com", "Portfólio: djweby.sk"].join("\n");

export function pickPain(o: Opportunity): string | null {
  return PAIN_ORDER.find((k) => o.observed.some((s) => s.key === k)) ?? null;
}

export function draftFirstMessage(opts: { opportunity: Opportunity; channel: DraftChannel; demoUrl: string | null }): Draft {
  const o = opts.opportunity;
  const pain = pickPain(o);
  const sys = o.recommended_system?.id ?? "";
  const idea = opts.demoUrl && IDEA[sys] ? IDEA[sys] : null;
  const lines =
    opts.channel === "SMS"
      ? [
          `Dobrý deň, Dominik Jankovič. Pozeral som váš web a ${pain ? PAIN[pain] : "zaujímalo ma, ako sa k vám zákazník objedná"}.`,
          idea ? `${idea} ${opts.demoUrl}` : "Robím weby, cez ktoré chodia hotové objednávky.",
          "Ak nechcete ďalšie správy, odpíšte STOP.",
        ]
      : [
          "Dobrý deň,",
          "",
          `pozeral som váš web a ${pain ? PAIN[pain] : "zaujímalo ma, ako sa k vám zákazník objedná"}...`,
          idea ? `${idea}` : "Robím weby, cez ktoré firme chodia hotové objednávky namiesto telefonátov.",
          opts.demoUrl ? "Odkaz na ukážku je nižšie." : "",
          "",
          CTA,
          "",
          SIGNATURE,
        ];
  let text = lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join(opts.channel === "SMS" ? " " : "\n").trim();
  // Telo e-mailu bez diakritiky, podpis a pätička ostávajú (meno sa píše správne).
  if (opts.channel === "EMAIL") text = `${stripDiacritics(text.slice(0, -SIGNATURE.length))}${SIGNATURE}\n\n${EMAIL_FOOTER}`;
  const draft: Draft = {
    channel: opts.channel,
    variant: `${sys || "generic"}:${pain ?? "none"}:${opts.demoUrl ? "demo" : "nodemo"}`,
    pain_code: pain,
    cta: opts.channel === "SMS" ? "odpíšte" : CTA,
    text,
    sms_segments: opts.channel === "SMS" ? smsSegments(text) : null,
    issues: [],
  };
  draft.issues = styleGuard(opts.channel === "EMAIL" ? draft.text.replace(EMAIL_FOOTER, "") : draft.text, { channel: opts.channel, hasObservation: !!pain, praiseEvidence: false });
  return draft;
}

/** Problémy, pre ktoré správa nesmie ísť na schválenie. Prázdne pole = OK. */
export function styleGuard(text: string, ctx: { channel: DraftChannel; hasObservation: boolean; praiseEvidence: boolean }): string[] {
  const issues: string[] = [];
  const low = text.toLowerCase();
  const lowPlain = stripDiacritics(low);
  for (const p of STYLE_BANNED) if (low.includes(p) || lowPlain.includes(stripDiacritics(p))) issues.push(`zakázaná fráza: „${p}“`);
  for (const p of findBannedPhrases([text])) issues.push(`AI fráza: „${p}“`);
  for (const w of forbiddenClaims([text])) issues.push(`nepodložené tvrdenie: ${w}`);
  if (/[—–]/.test(text)) issues.push("pomlčka (— alebo –), použi tri bodky");
  if ((text.match(/!/g) ?? []).length > 1) issues.push("viac ako jeden výkričník");
  if (PRAISE.test(text) && !ctx.praiseEvidence) issues.push("pochvala bez evidence");
  if (!ctx.hasObservation) issues.push("správa nehovorí o konkrétnom probléme, ktorý sme videli");
  if (/\bnemáte\b|\bnemate\b/i.test(text)) issues.push("„nemáte“: píš „nenašiel som“");
  if (ctx.channel === "EMAIL" && /\b[a-z0-9-]+\.sk\b/i.test(text)) issues.push("„.sk“ v texte e-mailu, Gmail ho obalí; odkaz daj ako link");
  if (ctx.channel === "SMS") {
    if (!/STOP/.test(text)) issues.push("SMS bez možnosti odhlásenia (STOP)");
    if (smsSegments(text) > 4) issues.push(`SMS má ${smsSegments(text)} segmentov, skráť na max. 4`);
  }
  return issues;
}

/** GSM-7 základná sada (bez rozšírenia). Slovenská diakritika v nej nie je → UCS-2. */
const GSM7 = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà]*$/;

export function smsSegments(text: string): number {
  const len = [...text].length;
  if (GSM7.test(text)) return len <= 160 ? 1 : Math.ceil(len / 153);
  return len <= 70 ? 1 : Math.ceil(len / 67);
}

export function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}
