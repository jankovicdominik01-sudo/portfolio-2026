/**
 * ROI z predpokladov. Nikdy nepočíta stratu v eurách, iba čas na ručné prvotné
 * spracovanie dopytov:
 *
 *   min/týždeň = N · t        h/rok = N · t · T / 60
 *
 * N = dopyty za týždeň, t = minúty na jeden, T = pracovné týždne v roku.
 * Rozsahy sa násobia ako intervaly. Ak je čo i len jeden vstup odhad, výsledok je ESTIMATE.
 */
import type { EvidenceLevel } from "./opportunity";

export type Range = readonly [number, number];
export type RoiInput = {
  perWeek: Range | number;
  minutesEach: Range | number;
  weeks?: Range | number;
  /** Odkiaľ sú vstupy. Bez zdroja = odhad. */
  source?: { perWeek?: string; minutesEach?: string } | null;
};
export type RoiResult = {
  minutesPerWeek: Range;
  hoursPerYear: Range;
  level: EvidenceLevel;
  assumptions: string[];
  formula: string;
};

/** Predvolene 48 až 52 pracovných týždňov (ASSUMPTION: dovolenky a sviatky). */
export const DEFAULT_WEEKS: Range = [48, 52];

const r = (x: Range | number): Range => (typeof x === "number" ? [x, x] : [Math.min(x[0], x[1]), Math.max(x[0], x[1])]);
const fmt = (x: Range, unit: string) => (x[0] === x[1] ? `${x[0]} ${unit}` : `${x[0]} až ${x[1]} ${unit}`);

export function roi(input: RoiInput): RoiResult {
  const n = r(input.perWeek);
  const t = r(input.minutesEach);
  const w = r(input.weeks ?? DEFAULT_WEEKS);
  if ([...n, ...t, ...w].some((v) => !Number.isFinite(v) || v < 0)) throw new RangeError("ROI: vstupy musia byť nezáporné čísla");
  const minutesPerWeek: Range = [n[0] * t[0], n[1] * t[1]];
  const hoursPerYear: Range = [Math.round((minutesPerWeek[0] * w[0]) / 60), Math.round((minutesPerWeek[1] * w[1]) / 60)];
  const src = input.source ?? {};
  const assumptions = [
    `${fmt(n, "dopytov týždenne")} (${src.perWeek ? `zdroj: ${src.perWeek}` : "ASSUMPTION"})`,
    `${fmt(t, "min na jeden dopyt")} (${src.minutesEach ? `zdroj: ${src.minutesEach}` : "ASSUMPTION"})`,
    `${fmt(w, "pracovných týždňov")} (ASSUMPTION)`,
  ];
  // Aj s overenými vstupmi je týždne predpoklad → výsledok je vždy ESTIMATE.
  return { minutesPerWeek, hoursPerYear, level: "ESTIMATE", assumptions, formula: "N × t × T / 60" };
}
