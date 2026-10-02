/**
 * Money Leak: vizualizácia ručnej práce, nie „koľko firma prerába“.
 *
 * Bez čísla dopytov od používateľa je všetko za odhadom minút na dopyt UNKNOWN.
 * Odhad minút vznikne iba vtedy, keď sme na webe videli ručný krok prvého kontaktu
 * a segment má predpoklady. Eurá sa nepočítajú nikdy, iba keď používateľ zadá
 * vlastnú hodinovú hodnotu.
 */
import type { EvidenceLevel, Pain, ProcessModel } from "./process";
import { roi, type Range } from "./roi";
import { MODULES, type ModuleId, type SegmentTemplate } from "./segments";

export const MONEY_LEAK_VERSION = "1.0";

/** Riadok podkladov (reklama, web, procesné signály). `value` je text, nikdy suma. */
export type LeakLine = { area: "ADS" | "WEBSITE" | "PROCESS"; label: string; value: string; level: EvidenceLevel; source: string | null };

export type MinuteEstimate = { level: "ESTIMATE"; unit: "min/dopyt"; value: Range; assumptions: string[]; evidence_ids: string[] };

export type MoneyLeakCard = {
  version: typeof MONEY_LEAK_VERSION;
  process: string[];
  process_level: EvidenceLevel;
  automation_fit: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  recommended: string[];
  /** null = ručný krok sme nevideli, odhad nerobíme. */
  estimate: MinuteEstimate | null;
  estimate_note: string;
  weekly_inquiries: "UNKNOWN";
  minutes_per_week: "UNKNOWN";
  annual_hours: "UNKNOWN";
  annual_saving: "UNKNOWN";
  lines: LeakLine[];
};

/** Painy, pri ktorých firma ručne spracúva každý prvý dopyt (z nich sa smie odhadnúť čas). */
const INTAKE_PAINS = ["MANUAL_BOOKING", "MANUAL_FIRST_INTAKE", "GENERIC_INQUIRY", "PHOTOS_VIA_MESSENGER", "MANUAL_QUOTE_PREP", "MANUAL_MEASUREMENT_COORDINATION"];

export function buildMoneyLeak(opts: {
  template: SegmentTemplate | null;
  pains: Pain[];
  process: ProcessModel;
  automationFit: MoneyLeakCard["automation_fit"];
  modules: ModuleId[];
  lines: LeakLine[];
}): MoneyLeakCard {
  const seen = opts.pains.filter((p) => !p.hypothesis && INTAKE_PAINS.includes(p.code));
  const t = opts.template;
  const estimate: MinuteEstimate | null =
    t && seen.length
      ? {
          level: "ESTIMATE",
          unit: "min/dopyt",
          value: t.minutes_per_inquiry.range,
          assumptions: [...t.minutes_per_inquiry.assumptions],
          evidence_ids: [...new Set(seen.flatMap((p) => p.evidence_ids))],
        }
      : null;
  return {
    version: MONEY_LEAK_VERSION,
    process: opts.process.steps.map((s) => `${s.actor === "customer" ? "zákazník" : "firma"} ${s.text}`),
    process_level: opts.process.level,
    automation_fit: opts.automationFit,
    recommended: opts.modules.map((m) => MODULES[m].label),
    estimate,
    estimate_note: estimate
      ? "Odhad času na jeden dopyt z predpokladov segmentu. Počet dopytov nevieme."
      : t
        ? "Ručný krok prvého kontaktu sme na webe nevideli, čas neodhadujeme."
        : "Pre segment nemáme predpoklady, čas neodhadujeme.",
    weekly_inquiries: "UNKNOWN",
    minutes_per_week: "UNKNOWN",
    annual_hours: "UNKNOWN",
    annual_saving: "UNKNOWN",
    lines: opts.lines,
  };
}

export type LeakWithVolume = {
  minutes_per_week: Range;
  hours_per_year: Range;
  /** Iba s hodinovou hodnotou od používateľa. Inak UNKNOWN. */
  value_per_year: Range | "UNKNOWN";
  level: "ESTIMATE";
  assumptions: string[];
};

/**
 * Keď používateľ zadá počet dopytov týždenne (a voliteľne hodinovú hodnotu), dopočíta čas.
 * Bez odhadu minút na dopyt nevieme nič, výsledok je null.
 */
export function leakWithVolume(card: MoneyLeakCard, perWeek: number | Range, hourlyValue?: number | null): LeakWithVolume | null {
  if (!card.estimate) return null;
  const r = roi({ perWeek, minutesEach: card.estimate.value, source: { perWeek: "zadal používateľ" } });
  const hv = typeof hourlyValue === "number" && Number.isFinite(hourlyValue) && hourlyValue > 0 ? hourlyValue : null;
  return {
    minutes_per_week: r.minutesPerWeek,
    hours_per_year: r.hoursPerYear,
    value_per_year: hv ? [Math.round(r.hoursPerYear[0] * hv), Math.round(r.hoursPerYear[1] * hv)] : "UNKNOWN",
    level: "ESTIMATE",
    assumptions: [...r.assumptions, ...card.estimate.assumptions, ...(hv ? [`${hv} za hodinu (zadal používateľ)`] : [])],
  };
}
