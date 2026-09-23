import type { Analysis, Company, Offer, Priority, Trust } from "./types";
import type { Signals } from "./ai/signals";
import { matchOffer } from "./ai/brief";

/** Stav dôvery namiesto „AI skóre 92/100“. */
export function computeTrust(company: Company, signals: Signals, analysis: Analysis): Trust {
  const web = signals.siteOk ? (signals.readable ? "verified" : "partial") : signals.hasWebsite ? "unverified" : "partial";
  const phone = signals.phoneMatchesLead.value ? "verified" : company.phone ? "partial" : "unverified";
  const companyTrust =
    signals.siteOk && (signals.phoneMatchesLead.value || signals.cityMentioned.value)
      ? "verified"
      : signals.siteOk || company.phone
        ? "partial"
        : "unverified";
  const sourced = analysis.observations[0]?.evidence_ids.length ?? 0;
  const hook = analysis.nothing_found || !analysis.primary_hook ? "unverified" : sourced ? "verified" : "partial";
  return { web, phone, company: companyTrust, hook };
}

/** Lead je pripravený na volanie iba ak máme číslo a overený dôvod. */
export function isReadyToCall(trust: Trust, analysis: Analysis) {
  return trust.phone !== "unverified" && trust.hook !== "unverified" && !analysis.nothing_found;
}

/** HOT / READY / CHECK / LOW — vždy s dôvodmi, nikdy číslo. */
export function computePriority(
  company: Company,
  trust: Trust,
  analysis: Analysis,
  offers: Offer[],
): { priority: Priority; reasons: string[] } {
  const offer = matchOffer(offers, company.category);
  if (analysis.nothing_found) return { priority: "low", reasons: ["Nenašli sme výrazný obchodný dôvod."] };

  const unverified = (Object.entries(trust) as [keyof Trust, string][]).filter(([, v]) => v === "unverified");
  if (unverified.length) {
    const names: Record<keyof Trust, string> = { web: "web", phone: "telefón", company: "firma", hook: "dôvod volania" };
    return { priority: "check", reasons: unverified.map(([k]) => `Treba overiť: ${names[k]}.`) };
  }

  const reasons = ["Kontakt a dôvod volania sú podložené."];
  const strong = trust.hook === "verified" && trust.company === "verified";
  if (strong && offer) {
    return {
      priority: "hot",
      reasons: [
        "Overená firma aj kontakt.",
        "Konkrétne pozorovanie so zdrojom.",
        `Máme pripravenú ponuku${offer.estimated_price ? ` (~${offer.estimated_price} €)` : ""}.`,
      ],
    };
  }
  if (trust.phone === "partial") reasons.push("Telefón je z katalógu/importu, na webe sme ho nenašli.");
  return { priority: "ready", reasons };
}

/* ─────────────── Deduplikácia ─────────────── */

const GENERIC_DOMAINS = [
  "facebook.com",
  "instagram.com",
  "gmail.com",
  "azet.sk",
  "zoznam.sk",
  "centrum.sk",
  "post.sk",
  "google.com",
  "sites.google.com",
  "firmy.sk",
  "zlatestranky.sk",
  "wix.com",
  "webnode.sk",
];

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(s\.?\s?r\.?\s?o\.?|a\.?\s?s\.?|spol\.?|firma)\b/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Kľúče v poradí priority: email → telefón → doména → názov+mesto. */
export function dedupeKeys(c: {
  name: string;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
}): string[] {
  const keys: string[] = [];
  if (c.email) keys.push(`email:${c.email.trim().toLowerCase()}`);
  if (c.phone) {
    let d = c.phone.replace(/[^\d+]/g, "");
    if (d.startsWith("00")) d = `+${d.slice(2)}`;
    if (d.startsWith("0")) d = `+421${d.slice(1)}`;
    if (d.length >= 10) keys.push(`phone:${d}`);
  }
  if (c.website) {
    try {
      const host = new URL(c.website).hostname.replace(/^www\./, "");
      if (!GENERIC_DOMAINS.some((g) => host === g || host.endsWith(`.${g}`))) keys.push(`domain:${host}`);
    } catch {
      /* ignore */
    }
  }
  keys.push(`name:${slug(c.name)}|${c.city ? slug(c.city) : ""}`);
  return keys;
}
